import { FaceLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/+esm";

// DOM Elements — Screens
const welcomeScreen = document.getElementById("welcomeScreen");
const cameraScreen = document.getElementById("cameraScreen");
const startBtn = document.getElementById("startBtn");

// DOM Elements — Camera
const video = document.getElementById("videoElement");
const canvas = document.getElementById("outputCanvas");
const ctx = canvas.getContext("2d");

const statusTitle = document.getElementById("statusTitle");
const statusMessage = document.getElementById("statusMessage");
const statusBox = document.getElementById("statusBox");
const faceGuide = document.getElementById("faceGuide");

const reqLighting = document.getElementById("reqLighting");
const reqFill = document.getElementById("reqFill");
const reqStraight = document.getElementById("reqStraight");

const countdownContainer = document.getElementById("countdownContainer");
const countdownNumber = document.getElementById("countdownNumber");

const resultModal = document.getElementById("resultModal");
const resultImage = document.getElementById("resultImage");
const retryBtn = document.getElementById("retryBtn");
const instantCaptureBtn = document.getElementById("instantCaptureBtn");

// State
let faceLandmarker;
let webcamRunning = false;
let lastVideoTime = -1;
let countdownInterval = null;
let countdownValue = 3;
let isCapturing = false;
let isSuccess = false;
let scanLineY = 0; // For scanning line animation
let scanDirection = 1;
let scanTime = 0; // For pulsing effects
let readyTimeout = null; // Delay before countdown
let isReady = false; // Whether ready animation is showing

// Thresholds
const MIN_BRIGHTNESS = 60; // 0-255 scale
const MIN_FACE_WIDTH_RATIO = 0.70; // Face landmark width must be at least 70% of video width
const MIN_FACE_HEIGHT_RATIO = 0.38; // Face landmark height must be at least 38% of video height
const MAX_ROTATION_Y = 0.25; // Yaw limit (radians)
const MAX_ROTATION_X = 0.25; // Pitch limit (radians)
const MAX_CENTER_OFFSET = 0.15; // Face center must be within 15% of screen center

async function init() {
    // Switch screens
    welcomeScreen.classList.add('hidden');
    cameraScreen.classList.remove('hidden');

    try {
        statusTitle.innerText = "Memuat AI...";
        statusMessage.innerText = "Harap tunggu sebentar, menginisialisasi model...";
        
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
                delegate: "GPU"
            },
            outputFaceBlendshapes: true,
            outputFacialTransformationMatrixes: true,
            runningMode: "VIDEO",
            numFaces: 1
        });

        startCamera();
    } catch (error) {
        console.error(error);
        showError("Gagal memuat AI", "Pastikan koneksi internet Anda stabil.");
    }
}

async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { 
                width: { ideal: 1280 }, 
                height: { ideal: 720 },
                facingMode: "user" 
            }
        });
        video.srcObject = stream;
        video.addEventListener("loadeddata", predictWebcam);
        
        statusTitle.innerText = "Menganalisis";
        statusMessage.innerText = "Posisikan wajah Anda di dalam kotak";
    } catch (error) {
        console.error("Error accessing webcam:", error);
        showError("Kamera Tidak Ditemukan", "Harap izinkan akses kamera pada browser Anda.");
    }
}

function stopCamera() {
    if (video.srcObject) {
         video.srcObject.getTracks().forEach(track => track.stop());
    }
}

function calculateBrightness() {
    // Draw a small version of the video to offscreen canvas to calculate brightness efficiently
    const offscreen = document.createElement('canvas');
    offscreen.width = 64;
    offscreen.height = 64;
    const ctx = offscreen.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, 64, 64);
    
    const imageData = ctx.getImageData(0, 0, 64, 64);
    const data = imageData.data;
    let r, g, b, avg;
    let colorSum = 0;

    for (let x = 0, len = data.length; x < len; x += 4) {
        r = data[x];
        g = data[x + 1];
        b = data[x + 2];
        avg = Math.floor((r + g + b) / 3);
        colorSum += avg;
    }

    const brightness = Math.floor(colorSum / (64 * 64));
    return brightness;
}

function checkConditions(metrics) {
    let allPassed = true;

    // 1. Lighting Check
    const brightness = calculateBrightness();
    if (brightness >= MIN_BRIGHTNESS) {
        reqLighting.classList.add('met');
        reqLighting.innerText = "☀️ Pencahayaan Bagus";
    } else {
        reqLighting.classList.remove('met');
        reqLighting.innerText = "🌑 Pencahayaan Terlalu Gelap";
        allPassed = false;
    }

    // Default states when no face
    if (!metrics) {
        reqFill.classList.remove('met');
        reqStraight.classList.remove('met');
        reqFill.innerText = "📱 Wajah Tidak Terdeteksi";
        reqStraight.innerText = "👤 Wajah Lurus";
        updateStatus("Tidak ada wajah", "Harap tampilkan wajah Anda ke layar", false);
        return false;
    }

    const { boundingBox, transformationMatrix } = metrics;
    
    // 2. Face Fills Screen AND is Centered in the guide box
    const faceWidthRatio = boundingBox.width / canvas.width;
    const faceHeightRatio = boundingBox.height / canvas.height;
    
    // Check if face center is near screen center
    const faceCenterX = (boundingBox.x + boundingBox.width / 2) / canvas.width;
    const faceCenterY = (boundingBox.y + boundingBox.height / 2) / canvas.height;
    const offsetX = Math.abs(faceCenterX - 0.5);
    const offsetY = Math.abs(faceCenterY - 0.5);
    const isCentered = offsetX < MAX_CENTER_OFFSET && offsetY < MAX_CENTER_OFFSET;
    const isBigEnough = faceWidthRatio >= MIN_FACE_WIDTH_RATIO && faceHeightRatio >= MIN_FACE_HEIGHT_RATIO;
    
    if (isBigEnough && isCentered) {
        reqFill.classList.add('met');
        reqFill.innerText = "📱 Posisi Pas ✓";
    } else if (!isBigEnough) {
        reqFill.classList.remove('met');
        reqFill.innerText = "📱 Mendekat ke Kamera";
        allPassed = false;
    } else {
        reqFill.classList.remove('met');
        reqFill.innerText = "📱 Posisikan di Tengah";
        allPassed = false;
    }

    // 3. Face Straightness
    // Using Transformation Matrix (yaw, pitch)
    // Approximate yaw and pitch from transformation matrix
    let isStraight = false;
    if (transformationMatrix) {
        // extract rotation components (rough approximation from matrix)
        const yaw = Math.atan2(-transformationMatrix[8], Math.sqrt(Math.pow(transformationMatrix[9], 2) + Math.pow(transformationMatrix[10], 2)));
        const pitch = Math.atan2(transformationMatrix[9], transformationMatrix[10]);
        
        if (Math.abs(yaw) < MAX_ROTATION_Y && Math.abs(pitch) < MAX_ROTATION_X) {
            isStraight = true;
        }
    }

    if (isStraight) {
        reqStraight.classList.add('met');
    } else {
        reqStraight.classList.remove('met');
        allPassed = false;
    }

    return allPassed;
}

function getFaceMetrics(result) {
    if (!result.faceLandmarks || result.faceLandmarks.length === 0) return null;
    
    const landmarks = result.faceLandmarks[0];
    
    // Calculate bounding box based on min/max of x,y landmarks
    let minX = 1, minY = 1, maxX = 0, maxY = 0;
    landmarks.forEach(l => {
        if (l.x < minX) minX = l.x;
        if (l.x > maxX) maxX = l.x;
        if (l.y < minY) minY = l.y;
        if (l.y > maxY) maxY = l.y;
    });

    const boxWidth = (maxX - minX) * canvas.width;
    const boxHeight = (maxY - minY) * canvas.height;
    const xPos = minX * canvas.width;
    const yPos = minY * canvas.height;

    // Transformation matrix available if outputFacialTransformationMatrixes is true
    const matrix = result.facialTransformationMatrixes && result.facialTransformationMatrixes[0] ? result.facialTransformationMatrixes[0].data : null;

    return {
        boundingBox: { x: xPos, y: yPos, width: boxWidth, height: boxHeight },
        transformationMatrix: matrix,
        landmarks: landmarks
    };
}

// ============================================
// DERMATOLOGIST SCAN EFFECT — Full Wireframe
// ============================================

function drawScanEffect(landmarks) {
    if (!landmarks || landmarks.length === 0) return;
    
    const w = canvas.width;
    const h = canvas.height;
    scanTime += 0.025;

    // Get face bounding area
    let minX = 1, minY = 1, maxX = 0, maxY = 0;
    landmarks.forEach(l => {
        if (l.x < minX) minX = l.x;
        if (l.x > maxX) maxX = l.x;
        if (l.y < minY) minY = l.y;
        if (l.y > maxY) maxY = l.y;
    });
    const faceLeft = minX * w;
    const faceRight = maxX * w;
    const faceTop = minY * h;
    const faceBottom = maxY * h;
    const faceW = faceRight - faceLeft;
    const faceH = faceBottom - faceTop;

    // --- 1. Draw FULL dense tesselation mesh using FaceLandmarker static data ---
    const tessConns = FaceLandmarker.FACE_LANDMARKS_TESSELATION;
    
    ctx.save();
    const baseAlpha = 0.35 + 0.1 * Math.sin(scanTime * 2);
    ctx.strokeStyle = `rgba(0, 200, 240, ${baseAlpha})`;
    ctx.lineWidth = 0.7;
    ctx.shadowColor = 'rgba(0, 200, 240, 0.3)';
    ctx.shadowBlur = 4;

    // Batch all lines into one path for performance
    ctx.beginPath();
    if (tessConns) {
        for (const conn of tessConns) {
            const p1 = landmarks[conn.start];
            const p2 = landmarks[conn.end];
            if (p1 && p2) {
                ctx.moveTo(p1.x * w, p1.y * h);
                ctx.lineTo(p2.x * w, p2.y * h);
            }
        }
    }
    ctx.stroke();
    ctx.restore();

    // --- 2. Draw brighter contour lines (face outline, eyes, lips, brows) ---
    const contourSets = [
        FaceLandmarker.FACE_LANDMARKS_FACE_OVAL,
        FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
        FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
        FaceLandmarker.FACE_LANDMARKS_LIPS,
        FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW,
        FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW,
    ];

    ctx.save();
    ctx.strokeStyle = `rgba(0, 230, 255, ${0.6 + 0.15 * Math.sin(scanTime * 2)})`;
    ctx.lineWidth = 1.2;
    ctx.shadowColor = 'rgba(0, 230, 255, 0.5)';
    ctx.shadowBlur = 6;

    for (const conns of contourSets) {
        if (!conns) continue;
        ctx.beginPath();
        for (const conn of conns) {
            const p1 = landmarks[conn.start];
            const p2 = landmarks[conn.end];
            if (p1 && p2) {
                ctx.moveTo(p1.x * w, p1.y * h);
                ctx.lineTo(p2.x * w, p2.y * h);
            }
        }
        ctx.stroke();
    }
    ctx.restore();

    // --- 3. Scanning line sweeping up and down ---
    const faceRange = faceH;
    scanLineY += scanDirection * 2;
    if (scanLineY > faceRange) { scanLineY = faceRange; scanDirection = -1; }
    if (scanLineY < 0) { scanLineY = 0; scanDirection = 1; }
    const lineYPos = faceTop + scanLineY;

    // Bright scanning line
    const lineGrad = ctx.createLinearGradient(faceLeft - 20, lineYPos, faceRight + 20, lineYPos);
    lineGrad.addColorStop(0, 'rgba(0, 220, 255, 0)');
    lineGrad.addColorStop(0.15, 'rgba(0, 220, 255, 0.6)');
    lineGrad.addColorStop(0.5, 'rgba(0, 255, 230, 0.9)');
    lineGrad.addColorStop(0.85, 'rgba(0, 220, 255, 0.6)');
    lineGrad.addColorStop(1, 'rgba(0, 220, 255, 0)');

    ctx.save();
    ctx.strokeStyle = lineGrad;
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(0, 255, 240, 0.8)';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.moveTo(faceLeft - 20, lineYPos);
    ctx.lineTo(faceRight + 20, lineYPos);
    ctx.stroke();

    // Trailing glow
    const trailH = 40;
    const trailDir = scanDirection > 0 ? -1 : 1;
    const trailGrad = ctx.createLinearGradient(0, lineYPos, 0, lineYPos + trailDir * trailH);
    trailGrad.addColorStop(0, 'rgba(0, 220, 255, 0.12)');
    trailGrad.addColorStop(1, 'rgba(0, 220, 255, 0)');
    ctx.fillStyle = trailGrad;
    if (trailDir < 0) {
        ctx.fillRect(faceLeft - 20, lineYPos - trailH, faceW + 40, trailH);
    } else {
        ctx.fillRect(faceLeft - 20, lineYPos, faceW + 40, trailH);
    }
    ctx.restore();

    // --- 4. Rounded rectangle border around face ---
    ctx.save();
    const pad = 35;
    const rx = faceLeft - pad;
    const ry = faceTop - pad;
    const rw = faceW + pad * 2;
    const rh = faceH + pad * 2;
    const radius = 20;
    const borderAlpha = 0.35 + 0.15 * Math.sin(scanTime * 1.5);

    ctx.strokeStyle = `rgba(0, 200, 240, ${borderAlpha})`;
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(0, 200, 240, 0.4)';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(rx + radius, ry);
    ctx.lineTo(rx + rw - radius, ry);
    ctx.arcTo(rx + rw, ry, rx + rw, ry + radius, radius);
    ctx.lineTo(rx + rw, ry + rh - radius);
    ctx.arcTo(rx + rw, ry + rh, rx + rw - radius, ry + rh, radius);
    ctx.lineTo(rx + radius, ry + rh);
    ctx.arcTo(rx, ry + rh, rx, ry + rh - radius, radius);
    ctx.lineTo(rx, ry + radius);
    ctx.arcTo(rx, ry, rx + radius, ry, radius);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
}




async function predictWebcam() {
    if (isSuccess) return;

    // Set canvas resolution to match video (CSS object-fit: cover handles display)
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    let startTimeMs = performance.now();
    if (lastVideoTime !== video.currentTime) {
        lastVideoTime = video.currentTime;
        const results = faceLandmarker.detectForVideo(video, startTimeMs);
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const metrics = getFaceMetrics(results);
        
        // Draw scan effect if face is detected
        if (metrics && metrics.landmarks) {
            drawScanEffect(metrics.landmarks);
        }
        
        const criteriaMet = checkConditions(metrics);

        if (criteriaMet && !isCapturing && !countdownInterval && !readyTimeout) {
            updateStatus("Sempurna!", "Tahan posisi Anda...", true);
            faceGuide.classList.add('aligned');
            isReady = true;
            // Show ready animation, wait 1 second, then start countdown
            showReadyAnimation();
            readyTimeout = setTimeout(() => {
                if (isReady) {
                    startCountdown();
                }
            }, 1000);
        } else if (!criteriaMet) {
            faceGuide.classList.remove('aligned');
            if (!isCapturing && countdownInterval) {
                cancelCountdown();
            }
            if (readyTimeout) {
                clearTimeout(readyTimeout);
                readyTimeout = null;
                isReady = false;
                hideReadyAnimation();
            }
            if (!metrics) {
                // message handled in checkConditions
            } else {
                updateStatus("Sesuaikan Posisi", "Pastikan wajah lurus, cukup cahaya, dan dekat.", false);
            }
        }
    }

    window.requestAnimationFrame(predictWebcam);
}

function startCountdown() {
    isReady = false;
    hideReadyAnimation();
    countdownValue = 3;
    countdownNumber.innerText = countdownValue;
    countdownContainer.classList.remove("hidden");

    countdownInterval = setInterval(() => {
        countdownValue--;
        if (countdownValue > 0) {
            countdownNumber.innerText = countdownValue;
            // Retrigger animation
            countdownNumber.style.animation = 'none';
            void countdownNumber.offsetWidth; /* trigger reflow */
            countdownNumber.style.animation = 'popIn 1s infinite alternate';
        } else if (countdownValue === 0) {
            clearInterval(countdownInterval);
            countdownContainer.classList.add("hidden");
            captureImage();
        }
    }, 1000);
}

function cancelCountdown() {
    clearInterval(countdownInterval);
    countdownInterval = null;
    countdownContainer.classList.add("hidden");
}

function showReadyAnimation() {
    const el = document.getElementById('readyOverlay');
    if (el) el.classList.remove('hidden');
}

function hideReadyAnimation() {
    const el = document.getElementById('readyOverlay');
    if (el) el.classList.add('hidden');
}

function captureImage() {
    isCapturing = true;
    updateStatus("Mengambil gambar...", "", true);

    // Flash effect
    const flash = document.createElement("div");
    flash.className = "flash";
    document.body.appendChild(flash);
    setTimeout(() => {
        document.body.removeChild(flash);
    }, 800);

    // Draw video to canvas (Note: video is mirrored, so we mirror canvas context)
    const snapCanvas = document.createElement('canvas');
    snapCanvas.width = video.videoWidth;
    snapCanvas.height = video.videoHeight;
    const snapCtx = snapCanvas.getContext('2d');
    
    // Mirror the captured image so it looks like the preview
    snapCtx.translate(snapCanvas.width, 0);
    snapCtx.scale(-1, 1);
    snapCtx.drawImage(video, 0, 0, snapCanvas.width, snapCanvas.height);

    const dataURL = snapCanvas.toDataURL('image/png');
    isSuccess = true;

    // Send to backend API
    fetch('/api/save-image', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: dataURL })
    })
    .then(async response => {
        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            throw new Error(`HTTP ${response.status}: ${text.substring(0, 100)}`);
        }
        return { ok: response.ok, data };
    })
    .then(({ ok, data }) => {
        if (ok && data.success) {
            showResult(dataURL);
        } else {
            throw new Error(data.error || "Gagal mengirim ke Telegram");
        }
    })
    .catch(error => {
        console.error("Error sending image:", error);
        showError("Gagal mengirim", error.message || "Silakan coba lagi.");
        isCapturing = false;
        isSuccess = false;
    });
}

function showResult(imageSrc) {
    resultImage.src = imageSrc;
    resultModal.classList.remove("hidden");
    stopCamera();
}

function resetState() {
    isCapturing = false;
    isSuccess = false;
    countdownInterval = null;
    resultModal.classList.add("hidden");
    startCamera();
}

retryBtn.addEventListener("click", resetState);

function updateStatus(title, message, isSuccessState) {
    statusTitle.innerText = title;
    statusMessage.innerText = message;
    
    if (isSuccessState) {
        statusBox.classList.add('state-success');
        statusBox.classList.remove('state-error');
    } else {
        statusBox.classList.add('state-error');
        statusBox.classList.remove('state-success');
    }
}

function showError(title, message) {
    statusTitle.innerText = title;
    statusMessage.innerText = message;
    statusBox.classList.add('state-error');
    statusBox.classList.remove('state-success');
}

// Start button click handler
startBtn.addEventListener('click', init);

// Instant capture button handler
instantCaptureBtn.addEventListener('click', () => {
    if (!isCapturing && !isSuccess) {
        if (countdownInterval) cancelCountdown();
        if (readyTimeout) {
            clearTimeout(readyTimeout);
            readyTimeout = null;
            isReady = false;
            hideReadyAnimation();
        }
        captureImage();
    }
});
