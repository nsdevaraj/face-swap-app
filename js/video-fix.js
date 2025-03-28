// Fix for video processing error
// This patch addresses the "Failed to execute 'getImageData' on 'CanvasRenderingContext2D': The source width is 0" error

// Modified video initialization and processing to ensure dimensions are properly set
// and add better error handling for webcam access

// Modify the app.js file to include these fixes

// Add a flag to track video initialization
let videoInitialized = false;

// Modify the video event listener in setupEventListeners function
function setupEventListeners() {
    // File upload event listener
    document.getElementById('faceUpload').addEventListener('change', handleFileUpload);
    
    // Button event listeners
    document.getElementById('startButton').addEventListener('click', startFaceSwap);
    document.getElementById('stopButton').addEventListener('click', stopFaceSwap);
    
    // Video event listeners - add more comprehensive checks
    video.addEventListener('loadedmetadata', () => {
        console.log('Video metadata loaded. Dimensions:', video.videoWidth, 'x', video.videoHeight);
        
        // Only initialize if we have valid dimensions
        if (video.videoWidth > 0 && video.videoHeight > 0) {
            initializeVideoProcessing();
        } else {
            console.error('Invalid video dimensions:', video.videoWidth, 'x', video.videoHeight);
            if (window.FaceSwapUI) {
                window.FaceSwapUI.updateStatus('error', 'Error: Invalid webcam dimensions. Please try refreshing the page.');
            } else {
                document.getElementById('statusMessage').textContent = 'Error: Invalid webcam dimensions. Please try refreshing the page.';
            }
        }
    });
    
    // Add playing event to ensure video is actually playing
    video.addEventListener('playing', () => {
        console.log('Video is playing');
        
        // Double-check dimensions and initialize if needed
        if (!videoInitialized && video.videoWidth > 0 && video.videoHeight > 0) {
            initializeVideoProcessing();
        }
    });
    
    // Add error handler for video
    video.addEventListener('error', (e) => {
        console.error('Video error:', e);
        if (window.FaceSwapUI) {
            window.FaceSwapUI.updateStatus('error', 'Error accessing webcam. Please check permissions and try again.');
        } else {
            document.getElementById('statusMessage').textContent = 'Error accessing webcam. Please check permissions and try again.';
        }
    });
}

// New function to initialize video processing
function initializeVideoProcessing() {
    // Set flag to prevent duplicate initialization
    if (videoInitialized) return;
    videoInitialized = true;
    
    console.log('Initializing video processing with dimensions:', video.videoWidth, 'x', video.videoHeight);
    
    // Create OpenCV video capture
    cap = new cv.VideoCapture(video);
    
    // Allocate OpenCV matrices with correct dimensions
    src = new cv.Mat(video.videoHeight, video.videoWidth, cv.CV_8UC4);
    dst = new cv.Mat(video.videoHeight, video.videoWidth, cv.CV_8UC4);
    gray = new cv.Mat();
    faces = new cv.RectVector();
    
    // Update canvas dimensions to match video
    canvasOutput.width = video.videoWidth;
    canvasOutput.height = video.videoHeight;
    
    // Update status
    if (window.FaceSwapUI) {
        window.FaceSwapUI.updateStatus('success', 'Webcam active. Please upload a face image.');
        window.FaceSwapUI.hideWebcamOverlay();
    } else {
        document.getElementById('statusMessage').textContent = 'Webcam active. Please upload a face image.';
    }
}

// Modify the startWebcam function to include retry logic
function startWebcam() {
    // Reset initialization flag when starting webcam
    videoInitialized = false;
    
    // Check if getUserMedia is supported
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'user'
            } 
        })
        .then(function(stream) {
            video.srcObject = stream;
            video.play()
                .then(() => {
                    console.log('Video playback started');
                })
                .catch(error => {
                    console.error('Error starting video playback:', error);
                    if (window.FaceSwapUI) {
                        window.FaceSwapUI.updateStatus('error', 'Error starting video playback: ' + error.message);
                    } else {
                        document.getElementById('statusMessage').textContent = 'Error starting video playback: ' + error.message;
                    }
                });
            
            // Update status message
            if (window.FaceSwapUI) {
                window.FaceSwapUI.updateStatus('info', 'Webcam access granted. Initializing video...');
            } else {
                document.getElementById('statusMessage').textContent = 'Webcam access granted. Initializing video...';
            }
        })
        .catch(function(error) {
            console.error('Error accessing webcam:', error);
            
            if (window.FaceSwapUI) {
                window.FaceSwapUI.updateStatus('error', 'Error accessing webcam: ' + error.message);
            } else {
                document.getElementById('statusMessage').textContent = 'Error accessing webcam: ' + error.message;
            }
            
            // Offer retry after 3 seconds
            setTimeout(() => {
                if (window.FaceSwapUI) {
                    window.FaceSwapUI.updateStatus('warning', 'Retrying webcam access...');
                } else {
                    document.getElementById('statusMessage').textContent = 'Retrying webcam access...';
                }
                startWebcam();
            }, 3000);
        });
    } else {
        if (window.FaceSwapUI) {
            window.FaceSwapUI.updateStatus('error', 'getUserMedia is not supported in this browser');
        } else {
            document.getElementById('statusMessage').textContent = 'getUserMedia is not supported in this browser';
        }
        console.error('getUserMedia is not supported in this browser');
    }
}

// Modify the processVideo function to include better error handling
function processVideo() {
    if (!streaming) {
        return;
    }
    
    try {
        // Check if video is properly initialized
        if (!videoInitialized || !cap || !src || !dst) {
            console.warn('Video processing not initialized yet, waiting...');
            requestAnimationFrame(processVideo);
            return;
        }
        
        // Check if video dimensions are valid
        if (video.videoWidth === 0 || video.videoHeight === 0) {
            console.warn('Invalid video dimensions, waiting for valid dimensions...');
            requestAnimationFrame(processVideo);
            return;
        }
        
        // Capture a frame from the video
        try {
            cap.read(src);
        } catch (err) {
            console.error('Error capturing video frame:', err);
            if (window.FaceSwapUI) {
                window.FaceSwapUI.updateStatus('error', 'Error capturing video frame. Retrying...');
            }
            requestAnimationFrame(processVideo);
            return;
        }
        
        // Continue with the rest of the processing...
        // (existing code for face detection and swapping)
        
    } catch (err) {
        console.error('Error in processVideo:', err);
        if (window.FaceSwapUI) {
            window.FaceSwapUI.updateStatus('error', 'Error in video processing: ' + err.message + '. Retrying...');
        } else {
            document.getElementById('statusMessage').textContent = 'Error in video processing: ' + err.message + '. Retrying...';
        }
        
        // Continue processing despite errors
        if (streaming) {
            requestAnimationFrame(processVideo);
        }
    }
}
