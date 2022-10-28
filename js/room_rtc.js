const APP_ID = "ce37f565cc404ece8eacf7a76ba3e80b"  // Agora - Livestream

let uid = sessionStorage.getItem('uid')
if(!uid) {
    uid = String(Math.floor(Math.random() * 10000))
    sessionStorage.setItem('uid', uid)
}

const queryString = window.location.search
const urlParams = new URLSearchParams(queryString)
let roomId = urlParams.get('room')

if(!roomId) {
    roomId = 'main'
}

let displayName = uid; // ★이쪽 우선 임시로! 이름 받아와서 이쪽에 저장해줘야 함

let token = null;
let client;

let rtmClient; // 현재 참가자 확인 목록
let channel;

let localTracks = []  // 오디오, 비디오 스트림
let remoteUsers = {}  // key values (유저의)

let localScreenTracks;
let sharingScreen = false;

let joinRoomInit = async () => {
    rtmClient = await AgoraRTM.createInstance(APP_ID)
    await rtmClient.login({uid, token})

    // ★await rtmClient.addOrUpdateLocalUserAttributes({'name':displayName}) // 참가자 리스트 이름으로 나오게 하는 것!

    channel = await rtmClient.createChannel(roomId)
    await channel.join()

    channel.on('MemberJoined', handleMemberJoined) // room_rtm에 구현
    channel.on('MemberLeft', handleMemberLeft)
    channel.on('ChannelMessage', handleChannelMessage)

    getMembers()

    // 위는 참가자 확인용 코드짜기

    client = AgoraRTC.createClient({mode:'rtc', codec:'vp8'})
    await client.join(APP_ID, roomId, token, uid)

    client.on('user-published', handleUserPublished) // 이거 있어야 자기 외의 다른 사용자 들어올 시 원 추가됨
    client.on('user-left', handleUserLeft) // 이거 있어야 사용자 나갔을 때 동그라미 없어짐

    joinStream()
}

let joinStream = async () => {
    localTracks = await AgoraRTC.createMicrophoneAndCameraTracks()

    let player = `<div class="video__container" id="user-container-${uid}">
                    <div class="video-player" id="user-${uid}"></div>
                </div>` // 참여자의 화면 (아래에 뜨는 video container 불러옴)

    document.getElementById('streams__container').insertAdjacentHTML('beforeend', player)
    document.getElementById(`user-container-${uid}`).addEventListener('click', expandVideoFrame)

    localTracks[1].play(`user-${uid}`)
    await client.publish([localTracks[0], localTracks[1]])
}

let switchToCamera = async() => {
    let player = `<div class="video__container" id="user-container-${uid}">
                <div class="video-player" id="user-${uid}"></div>
                </div>`
    displayFrame.insertAdjacentHTML('beforeend', player)
    //await localTracks[0].setMuted(true)
    //await localTracks[1].setMuted(true)

    // document.getElementById('mic-btn').classList.remove('active')
    document.getElementById('screen-btn').classList.remove('active')

    document.getElementById(`user-container-${uid}`).addEventListener('click', expandVideoFrame)
    // 위 코드 추가해줬더니 화면 공유 멈춘 후에도 클릭 가능해짐 (expandVideoFrame)

    localTracks[1].play(`user-${uid}`)
    await client.publish([localTracks[1]])
}

let handleUserPublished = async (user, mediaType) => {
    remoteUsers[user.uid] = user

    await client.subscribe(user, mediaType)

    let player = document.getElementById(`user-container-${user.uid}`)
    if (player == null) {
        player = `<div class="video__container" id="user-container-${user.uid}">
            <div class="video-player" id="user-${user.uid}"></div>
            </div>`

        document.getElementById('streams__container').insertAdjacentHTML('beforeend', player) // 이 뒤 내용 꼭 넣어줘야 함
        document.getElementById(`user-container-${user.uid}`).addEventListener('click', expandVideoFrame)
        }

    if (displayFrame.style.display) {
        
    } // 화면 공유 중 특별히 유지해야 하는 조건 있으면 여기 추가

    if (mediaType == 'video') {
        user.videoTrack.play(`user-${user.uid}`)
    }

    if (mediaType == 'audio') {
        user.audioTrack.play()
    }
}

let handleUserLeft = async (user) => {
    delete remoteUsers[user.uid]
    document.getElementById(`user-container-${user.uid}`).remove()

}

let toggleCamera = async (e) => {
    let button = e.currentTarget

    if(localTracks[1].muted) {
        await localTracks[1].setMuted(false)
        button.classList.add('active')
    } else {
        await localTracks[1].setMuted(true)
        button.classList.remove('active')
    }
}

let toggleMic = async (e) => {
    let button = e.currentTarget

    if(localTracks[0].muted) {
        await localTracks[0].setMuted(false)
        button.classList.add('active')
    } else {
        await localTracks[0].setMuted(true)
        button.classList.remove('active')
    }
}

let toggleScreen = async (e) => {
    let screenbutton = e.currentTarget

    if(!sharingScreen) {
        sharingScreen = true

        screenbutton.classList.add('active')

        localScreenTracks = await AgoraRTC.createScreenVideoTrack()

        document.getElementById(`user-container-${uid}`).remove()
        // displayFrame.style.display = 'block'
        // 위의 두 줄 코드

        let player = `<div class="video__container" id="user-container-${uid}">
        <div class="video-player" id="user-${uid}"></div>
        </div>`

        displayFrame.insertAdjacentHTML('beforeend', player)
        document.getElementById(`user-container-${uid}`).addEventListener('click', expandVideoFrame)

        userIdInDisplayFrame = `user-container-${uid}`
        localScreenTracks.play(`user-${uid}`)

        await client.unpublish([localTracks[1]])
        await client.publish([localScreenTracks]) // 이거 하면 다른 사람 화면에서도 동그라미에 화면 공유한 거 보임

        if (localScreenTracks) {
            localScreenTracks.on('track-ended', () => {
                // console.log('track-ended');
                // console.log('you can run your code here to stop screen')
                sharingScreen = false
                document.getElementById(`user-container-${uid}`).remove()
                switchToCamera()
            })
          } // 화면 공유 중지 시 화면 active 사라지고 switchToCamera() 하게 만듦
       

    }
    
    else { 
        sharingScreen = false
        document.getElementById(`user-container-${uid}`).remove()
        await client.unpublish([localScreenTracks])

        switchToCamera()
    }
}


document.getElementById('camera-btn').addEventListener('click', toggleCamera)
document.getElementById('mic-btn').addEventListener('click', toggleMic)
document.getElementById('screen-btn').addEventListener('click', toggleScreen)

joinRoomInit()