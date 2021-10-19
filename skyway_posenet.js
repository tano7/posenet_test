const imageScaleFactor = 0.2;
const outputStride = 16;
const flipHorizontal = false;
const stats = new Stats();
const contentWidth = 600;
const contentHeight = 500;
const minConfidence = 0.5;
const color = 'aqua';

let localStream;

const Peer = window.Peer;

const localVideo = document.getElementById('js-local-stream');
const localId = document.getElementById('js-local-id');
const callTrigger = document.getElementById('js-call-trigger');
const closeTrigger = document.getElementById('js-close-trigger');
const remoteVideo = document.getElementById('js-remote-stream');
const remoteId = document.getElementById('js-remote-id');
const meta = document.getElementById('js-meta');
const sdkSrc = document.querySelector('script[src*=skyway]');

meta.innerText = `
    UA: ${navigator.userAgent}
    SDK: ${sdkSrc ? sdkSrc.src : 'unknown'}
  `.trim();

const peer = (window.peer = new Peer({
key: window.__SKYWAY_KEY__,
debug: 3,
}));

// Register caller handler
callTrigger.addEventListener('click', () => {
    // Note that you need to ensure the peer has connected to signaling server
    // before using methods of peer instance.
    if (!peer.open) {
      return;
    }

    const mediaConnection = peer.call(remoteId.value, localStream);

    mediaConnection.on('stream', async stream => {
      // Render remote stream for caller
      remoteVideo.srcObject = stream;
      remoteVideo.playsInline = true;
      await remoteVideo.play().catch(console.error);
});

mediaConnection.once('close', () => {
    remoteVideo.srcObject.getTracks().forEach(track => track.stop());
    remoteVideo.srcObject = null;
});

closeTrigger.addEventListener('click', () => mediaConnection.close(true));
});

peer.once('open', id => (localId.textContent = id));

// Register callee handler
peer.on('call', mediaConnection => {
mediaConnection.answer(localStream);

mediaConnection.on('stream', async stream => {
    // Render remote stream for callee
    remoteVideo.srcObject = stream;
    remoteVideo.playsInline = true;
    await remoteVideo.play().catch(console.error);
});

mediaConnection.once('close', () => {
    remoteVideo.srcObject.getTracks().forEach(track => track.stop());
    remoteVideo.srcObject = null;
});

closeTrigger.addEventListener('click', () => mediaConnection.close(true));
});

peer.on('error', console.error);


//以下PoseNetぱーと
bindPage();

async function bindPage() {
    const net = await posenet.load(); // posenetの呼び出し
    let video;
    try {
        video = await loadVideo(); // video属性をロード
    } catch(e) {
        console.error(e);
        return;
    }
    detectPoseInRealTime(video, net);
}

// video属性のロード
async function loadVideo() {
    const video = await setupCamera(); // カメラのセットアップ
    video.play();
    return video;
}

// カメラのセットアップ
// video属性からストリームを取得する
async function setupCamera() {
    const video = document.getElementById('video');
    video.width = contentWidth;
    video.height = contentHeight;

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
            'audio': false,
            'video': true});
        video.srcObject = stream;

        //SkyWayで相手に映像を返すためにグローバルに保存しておく
        localStream = stream;

        return new Promise(resolve => {
            video.onloadedmetadata = () => {
                resolve(video);
            };
        });
    } else {
        const errorMessage = "This browser does not support video capture, or this device does not have a camera";
        alert(errorMessage);
        return Promise.reject(errorMessage);
    }
}

function setupFPS() {
    stats.showPanel(0);  // 0: fps, 1: ms, 2: mb, 3+: custom
    document.getElementById('main').appendChild(stats.dom);
  }

// 取得したストリームをestimateSinglePose()に渡して姿勢予測を実行
// requestAnimationFrameによってフレームを再描画し続ける
function detectPoseInRealTime(video, net) {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const flipHorizontal = true; // since images are being fed from a webcam

    canvas.width = contentWidth;
    canvas.height = contentHeight;

    async function poseDetectionFrame() {
        stats.begin();
        let poses = [];
        const pose = await net.estimateSinglePose(video, imageScaleFactor, flipHorizontal, outputStride);
        poses.push(pose);

        ctx.clearRect(0, 0, contentWidth,contentHeight);

        ctx.save();
        // keypointの位置を合わせるためにここ(-1,1)->(1,1)に変更済み
        ctx.scale(-1, 1);
        ctx.translate(contentWidth, 0);
        ctx.drawImage(video, 0, 0, contentWidth, contentHeight);
        ctx.restore();

        // drawWrist弄れば描画可能
        // poses.forEach(({ score, keypoints }) => {
        //     // keypoints[9]には左手、keypoints[10]には右手の予測結果が格納されている 
        //     drawWristPoint(keypoints[9],ctx);
        //     drawWristPoint(keypoints[10],ctx);
        // });

        poses.forEach(({score, keypoints}) => {
            // if(score >= minConfidence) {
                drawKeypoints(keypoints, minConfidence, ctx);
            // }
        });

        console.log(pose);

        stats.end();

        requestAnimationFrame(poseDetectionFrame);
    }
    poseDetectionFrame();
}

// 与えられたKeypointをcanvasに描画する
function drawWristPoint(wrist,ctx){
    ctx.beginPath();
    ctx.arc(wrist.position.x , wrist.position.y, 3, 0, 2 * Math.PI);
    ctx.fillStyle = "pink";
    ctx.fill();
}

function drawKeypoints(keypoints, minConfidence, ctx, scale = 1) {
    for (let i = 0; i < keypoints.length; i++) {
      const keypoint = keypoints[i];
  
      if (keypoint.score < minConfidence) {
        continue;
      }
  
      const {y, x} = keypoint.position;
      drawPoint(ctx, y * scale, x * scale, 3, color);
    }
  }

function drawPoint(ctx, y, x, r, color) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
}