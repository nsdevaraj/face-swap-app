// Alternative approach to video processing using HTML5 Canvas instead of OpenCV VideoCapture
// This file replaces the problematic VideoCapture implementation with a more robust solution

// Global variables
let video = null; // Webcam video element
let uploadedFace = null; // Uploaded face image
let faceCascade = null; // Face detection classifier
let streaming = false; // Flag to track if video streaming is active
let canvasOutput = null; // Canvas for displaying output
let canvasInput = null; // Canvas for capturing video frames
let ctxInput = null; // Canvas context for input
let src = null; // Source image from video
let dst = null; // Destination image for processing
let gray = null; // Grayscale image for processing
let faces = null; // Detected faces
let lastDetectionTime = 0; // Last time face detection was performed
let detectionThrottleMs = 100; // Throttle face detection to improve performance
let videoInitialized = false; // Flag to track video initialization
let opencvReady = false; // Flag to track OpenCV.js loading state

// Called when OpenCV.js is ready
function onOpenCvReady() {
  console.log("OpenCV.js is loaded");
  opencvReady = true;
  document.getElementById("statusMessage").textContent =
    "OpenCV.js is loaded. Loading models...";

  // Wait a short moment to ensure OpenCV is fully initialized
  setTimeout(() => {
    // Load the face cascade classifier
    loadFaceCascade();

    // Initialize video and other elements
    initializeElements();

    // Set up event listeners
    setupEventListeners();
  }, 100);
}

// Load the face cascade classifier
function loadFaceCascade() {
  if (!opencvReady) {
    console.error("OpenCV.js is not ready yet");
    return;
  }

  try {
    // Create a file utils instance for loading external files
    let utils = new Utils("statusMessage");

    // Load the face cascade file
    utils.createFileFromUrl(
      "haarcascade_frontalface_default.xml",
      "models/haarcascade_frontalface_default.xml",
      () => {
        try {
          // Once loaded, create the cascade classifier
          faceCascade = new cv.CascadeClassifier();

          // Load the face cascade
          let result = faceCascade.load("haarcascade_frontalface_default.xml");

          if (result) {
            document.getElementById("statusMessage").textContent =
              "Face detection model loaded. Please allow webcam access.";

            // Enable webcam access
            startWebcam();
          } else {
            document.getElementById("statusMessage").textContent =
              "Failed to load face detection model.";
            console.error("Failed to load face cascade classifier");
          }
        } catch (error) {
          console.error("Error creating cascade classifier:", error);
          document.getElementById("statusMessage").textContent =
            "Error loading face detection model.";
        }
      }
    );
  } catch (error) {
    console.error("Error in loadFaceCascade:", error);
    document.getElementById("statusMessage").textContent =
      "Error initializing face detection.";
  }
}

// Initialize video and other elements
function initializeElements() {
  // Get HTML elements
  video = document.getElementById("webcam");
  canvasOutput = document.getElementById("outputCanvas");

  // Create a hidden canvas for capturing video frames
  canvasInput = document.createElement("canvas");
  canvasInput.style.display = "none";
  document.body.appendChild(canvasInput);

  // Set initial canvas sizes
  canvasOutput.width = 640;
  canvasOutput.height = 480;
  canvasInput.width = 640;
  canvasInput.height = 480;

  // Get canvas context
  ctxInput = canvasInput.getContext("2d");
}

// Set up event listeners
function setupEventListeners() {
  // File upload event listener
  document
    .getElementById("faceUpload")
    .addEventListener("change", handleFileUpload);

  // Button event listeners
  document
    .getElementById("startButton")
    .addEventListener("click", startFaceSwap);
  document.getElementById("stopButton").addEventListener("click", stopFaceSwap);

  // Video event listeners - add comprehensive checks
  video.addEventListener("loadedmetadata", () => {
    console.log(
      "Video metadata loaded. Dimensions:",
      video.videoWidth,
      "x",
      video.videoHeight
    );

    // Only initialize if we have valid dimensions
    if (video.videoWidth > 0 && video.videoHeight > 0) {
      initializeVideoProcessing();
    } else {
      console.error(
        "Invalid video dimensions:",
        video.videoWidth,
        "x",
        video.videoHeight
      );
      if (window.FaceSwapUI) {
        window.FaceSwapUI.updateStatus(
          "error",
          "Error: Invalid webcam dimensions. Please try refreshing the page."
        );
      } else {
        document.getElementById("statusMessage").textContent =
          "Error: Invalid webcam dimensions. Please try refreshing the page.";
      }
    }
  });

  // Add playing event to ensure video is actually playing
  video.addEventListener("playing", () => {
    console.log("Video is playing");

    // Double-check dimensions and initialize if needed
    if (!videoInitialized && video.videoWidth > 0 && video.videoHeight > 0) {
      initializeVideoProcessing();
    }
  });

  // Add error handler for video
  video.addEventListener("error", (e) => {
    console.error("Video error:", e);
    if (window.FaceSwapUI) {
      window.FaceSwapUI.updateStatus(
        "error",
        "Error accessing webcam. Please check permissions and try again."
      );
    } else {
      document.getElementById("statusMessage").textContent =
        "Error accessing webcam. Please check permissions and try again.";
    }
  });
}

// Initialize video processing
function initializeVideoProcessing() {
  // Clean up any existing resources
  if (src) src.delete();
  if (dst) dst.delete();
  if (gray) gray.delete();
  if (faces) faces.delete();

  // Set flag to prevent duplicate initialization
  videoInitialized = true;

  console.log(
    "Initializing video processing with dimensions:",
    video.videoWidth,
    "x",
    video.videoHeight
  );

  // Update canvas dimensions to match video
  canvasInput.width = video.videoWidth;
  canvasInput.height = video.videoHeight;
  canvasOutput.width = video.videoWidth;
  canvasOutput.height = video.videoHeight;

  // Allocate OpenCV matrices with correct dimensions
  src = new cv.Mat(video.videoHeight, video.videoWidth, cv.CV_8UC4);
  dst = new cv.Mat(video.videoHeight, video.videoWidth, cv.CV_8UC4);
  gray = new cv.Mat();
  faces = new cv.RectVector();

  // Update status
  if (window.FaceSwapUI) {
    window.FaceSwapUI.updateStatus(
      "success",
      "Webcam active. Please upload a face image."
    );
    window.FaceSwapUI.hideWebcamOverlay();
  } else {
    document.getElementById("statusMessage").textContent =
      "Webcam active. Please upload a face image.";
  }
}

// Start webcam access
function startWebcam() {
  // Reset initialization flag when starting webcam
  videoInitialized = false;

  // Check if getUserMedia is supported
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices
      .getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
      })
      .then(function (stream) {
        video.srcObject = stream;
        video
          .play()
          .then(() => {
            console.log("Video playback started");
          })
          .catch((error) => {
            console.error("Error starting video playback:", error);
            if (window.FaceSwapUI) {
              window.FaceSwapUI.updateStatus(
                "error",
                "Error starting video playback: " + error.message
              );
            } else {
              document.getElementById("statusMessage").textContent =
                "Error starting video playback: " + error.message;
            }
          });

        // Update status message
        if (window.FaceSwapUI) {
          window.FaceSwapUI.updateStatus(
            "info",
            "Webcam access granted. Initializing video..."
          );
        } else {
          document.getElementById("statusMessage").textContent =
            "Webcam access granted. Initializing video...";
        }
      })
      .catch(function (error) {
        console.error("Error accessing webcam:", error);

        if (window.FaceSwapUI) {
          window.FaceSwapUI.updateStatus(
            "error",
            "Error accessing webcam: " + error.message
          );
        } else {
          document.getElementById("statusMessage").textContent =
            "Error accessing webcam: " + error.message;
        }

        // Offer retry after 3 seconds
        setTimeout(() => {
          if (window.FaceSwapUI) {
            window.FaceSwapUI.updateStatus(
              "warning",
              "Retrying webcam access..."
            );
          } else {
            document.getElementById("statusMessage").textContent =
              "Retrying webcam access...";
          }
          startWebcam();
        }, 3000);
      });
  } else {
    if (window.FaceSwapUI) {
      window.FaceSwapUI.updateStatus(
        "error",
        "getUserMedia is not supported in this browser"
      );
    } else {
      document.getElementById("statusMessage").textContent =
        "getUserMedia is not supported in this browser";
    }
    console.error("getUserMedia is not supported in this browser");
  }
}

// Handle file upload for face image
function handleFileUpload(event) {
  const file = event.target.files[0];

  if (file) {
    // Create a FileReader to read the uploaded image
    const reader = new FileReader();

    reader.onload = function (e) {
      // Create an image element to display the preview
      const img = new Image();
      img.src = e.target.result;

      img.onload = function () {
        // Display the uploaded image preview
        const previewContainer = document.getElementById("uploadPreview");
        previewContainer.innerHTML = "";
        previewContainer.appendChild(img);

        try {
          // Create a temporary canvas to ensure proper image format
          const tempCanvas = document.createElement("canvas");
          tempCanvas.width = img.width;
          tempCanvas.height = img.height;
          const tempCtx = tempCanvas.getContext("2d");
          tempCtx.drawImage(img, 0, 0);

          // Store the uploaded face image for processing
          uploadedFace = cv.imread(tempCanvas);

          // Detect faces in the uploaded image to verify it contains a face
          let uploadedGray = new cv.Mat();
          let uploadedFaces = new cv.RectVector();

          // Convert to grayscale for face detection
          cv.cvtColor(uploadedFace, uploadedGray, cv.COLOR_RGBA2GRAY);

          // Detect faces in the uploaded image
          faceCascade.detectMultiScale(uploadedGray, uploadedFaces, 1.1, 3, 0);

          if (uploadedFaces.size() > 0) {
            // Enable the start button if a face is detected
            document.getElementById("startButton").disabled = false;
            document.getElementById(
              "statusMessage"
            ).textContent = `Face detected in uploaded image. Click "Start Face Swap" to begin.`;

            // Draw rectangle around the detected face in the preview
            let face = uploadedFaces.get(0);
            let point1 = new cv.Point(face.x, face.y);
            let point2 = new cv.Point(
              face.x + face.width,
              face.y + face.height
            );
            cv.rectangle(uploadedFace, point1, point2, [0, 255, 0, 255], 2);

            // Display the annotated image
            let canvas = document.createElement("canvas");
            previewContainer.innerHTML = "";
            previewContainer.appendChild(canvas);
            cv.imshow(canvas, uploadedFace);
          } else {
            document.getElementById("statusMessage").textContent =
              "No face detected in the uploaded image. Please upload a different image.";
          }

          // Clean up
          uploadedGray.delete();
          uploadedFaces.delete();
        } catch (error) {
          console.error("Error processing uploaded image:", error);
          document.getElementById("statusMessage").textContent =
            "Error processing uploaded image. Please try a different image.";
        }
      };
    };

    reader.readAsDataURL(file);
  }
}

// Start face swapping process
function startFaceSwap() {
  if (!faceCascade || !uploadedFace) {
    if (window.FaceSwapUI) {
      window.FaceSwapUI.updateStatus(
        "error",
        "Error: Face cascade or uploaded face not loaded."
      );
    } else {
      document.getElementById("statusMessage").textContent =
        "Error: Face cascade or uploaded face not loaded.";
    }
    return;
  }

  // Set streaming flag to true
  streaming = true;

  // Update UI
  document.getElementById("startButton").disabled = true;
  document.getElementById("stopButton").disabled = false;

  if (window.FaceSwapUI) {
    window.FaceSwapUI.updateStatus("success", "Face swapping in progress...");
    window.FaceSwapUI.hideOutputOverlay();
    window.FaceSwapUI.enableCaptureButton();
  } else {
    document.getElementById("statusMessage").textContent =
      "Face swapping in progress...";
  }

  // Start processing frames
  processVideo();
}

// Stop face swapping process
function stopFaceSwap() {
  // Set streaming flag to false
  streaming = false;

  // Update UI
  document.getElementById("startButton").disabled = false;
  document.getElementById("stopButton").disabled = true;

  if (window.FaceSwapUI) {
    window.FaceSwapUI.updateStatus("info", "Face swapping stopped.");
    window.FaceSwapUI.showOutputOverlay();
    window.FaceSwapUI.disableCaptureButton();
  } else {
    document.getElementById("statusMessage").textContent =
      "Face swapping stopped.";
  }
}

// Process video frames for face detection and swapping
function processVideo() {
  if (!streaming) {
    return;
  }

  try {
    // Check if video is properly initialized
    if (!videoInitialized || !src || !dst) {
      console.warn("Video processing not initialized yet, waiting...");
      requestAnimationFrame(processVideo);
      return;
    }

    // Check if video dimensions are valid
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.warn("Invalid video dimensions, waiting for valid dimensions...");
      requestAnimationFrame(processVideo);
      return;
    }

    // Check if dimensions have changed and reinitialize if needed
    if (src.rows !== video.videoHeight || src.cols !== video.videoWidth) {
      console.log("Video dimensions changed, reinitializing matrices...");
      initializeVideoProcessing();
    }

    // Draw the current video frame to the hidden canvas
    try {
      ctxInput.drawImage(video, 0, 0, canvasInput.width, canvasInput.height);

      // Get the image data from the canvas
      let imageData = ctxInput.getImageData(
        0,
        0,
        canvasInput.width,
        canvasInput.height
      );

      // Convert the image data to an OpenCV matrix
      src.data.set(new Uint8Array(imageData.data));
    } catch (err) {
      console.error("Error capturing video frame:", err);
      if (window.FaceSwapUI) {
        window.FaceSwapUI.updateStatus(
          "error",
          "Error capturing video frame. Reinitializing..."
        );
      }
      // Reinitialize on error
      setTimeout(() => {
        initializeVideoProcessing();
      }, 1000);
      requestAnimationFrame(processVideo);
      return;
    }

    // Clone the source frame to the destination
    src.copyTo(dst);

    // Get current time for throttling
    const now = Date.now();

    // Only perform face detection at specified intervals to improve performance
    if (now - lastDetectionTime > detectionThrottleMs) {
      // Convert to grayscale for face detection
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

      // Apply histogram equalization to improve detection in different lighting
      let equalizedGray = new cv.Mat();
      cv.equalizeHist(gray, equalizedGray);

      // Clear previous faces
      faces.delete();
      faces = new cv.RectVector();

      // Detect faces with optimized parameters
      // Parameters: image, objects, scaleFactor, minNeighbors, flags, minSize, maxSize
      faceCascade.detectMultiScale(
        equalizedGray, // Input image
        faces, // Output vector of detected faces
        1.2, // Scale factor (how much the image size is reduced at each scale)
        5, // Min neighbors (higher value = less detections but higher quality)
        0, // Flags (not used)
        new cv.Size(60, 60), // Min face size
        new cv.Size(0, 0) // Max face size (0,0 means no limit)
      );

      // Update last detection time
      lastDetectionTime = now;

      // Clean up
      equalizedGray.delete();
    }

    // Get UI settings if available
    let blendingStrength = 80;
    let smoothingAmount = 50;
    let showFaceBoxes = true;

    if (window.FaceSwapUI) {
      blendingStrength = window.FaceSwapUI.getBlendingStrength();
      smoothingAmount = window.FaceSwapUI.getSmoothing();
      showFaceBoxes = window.FaceSwapUI.getShowFaceBoxes();

      // Hide webcam overlay once we're processing
      window.FaceSwapUI.hideWebcamOverlay();
    }

    // If we have an uploaded face image and detected faces in the video,
    // perform face swapping
    if (uploadedFace && faces.size() > 0) {
      // Apply face swapping algorithm with UI settings
      let swappedResult = swapFaces(uploadedFace, src, faces);

      // Apply smoothing based on UI settings
      if (smoothingAmount > 0) {
        let smoothedResult = new cv.Mat();
        let ksize = Math.max(1, Math.floor(smoothingAmount / 10)) * 2 + 1; // Ensure odd number
        cv.GaussianBlur(
          swappedResult,
          smoothedResult,
          new cv.Size(ksize, ksize),
          0,
          0
        );
        swappedResult.delete();
        swappedResult = smoothedResult;
      }

      // Use the swapped result as our destination
      dst.delete();
      dst = swappedResult;

      // Add face swapping indicator
      let swapText = "Face Swapping Active";
      cv.putText(
        dst,
        swapText,
        new cv.Point(10, dst.rows - 20),
        cv.FONT_HERSHEY_SIMPLEX,
        0.7,
        [0, 255, 0, 255],
        1
      );

      // Update UI status if first successful swap
      if (window.FaceSwapUI && faces.size() > 0) {
        window.FaceSwapUI.updateStatus(
          "success",
          `Face swapping active with ${faces.size()} detected faces`
        );
      }
    } else {
      // If not swapping, just draw rectangles around detected faces
      if (showFaceBoxes) {
        for (let i = 0; i < faces.size(); ++i) {
          // Get the current face
          let face = faces.get(i);

          // Draw rectangle around the face
          let point1 = new cv.Point(face.x, face.y);
          let point2 = new cv.Point(face.x + face.width, face.y + face.height);
          cv.rectangle(dst, point1, point2, [0, 255, 0, 255], 2);

          // Add face detection information
          let text = `Face ${i + 1}`;
          let fontScale = 0.5;
          let thickness = 1;
          let fontFace = cv.FONT_HERSHEY_SIMPLEX;
          let textSize = cv.getTextSize(text, fontFace, fontScale, thickness);
          let textOrg = new cv.Point(face.x, face.y - 5);

          // Draw text background
          cv.rectangle(
            dst,
            new cv.Point(textOrg.x, textOrg.y - textSize.height),
            new cv.Point(textOrg.x + textSize.width, textOrg.y + 5),
            [0, 0, 0, 128],
            cv.FILLED
          );

          // Draw text
          cv.putText(
            dst,
            text,
            textOrg,
            fontFace,
            fontScale,
            [255, 255, 255, 255],
            thickness
          );
        }
      }

      // Update UI if no faces detected
      if (window.FaceSwapUI && faces.size() === 0 && uploadedFace) {
        window.FaceSwapUI.updateStatus(
          "warning",
          "No faces detected in webcam feed"
        );
      }
    }

    // Add detection stats
    let statsText = `Detected faces: ${faces.size()}`;
    cv.putText(
      dst,
      statsText,
      new cv.Point(10, 30),
      cv.FONT_HERSHEY_SIMPLEX,
      0.7,
      [255, 0, 0, 255],
      1
    );

    // Display the result on the canvas
    cv.imshow("outputCanvas", dst);
  } catch (err) {
    console.error("Error in processVideo:", err);
    if (window.FaceSwapUI) {
      window.FaceSwapUI.updateStatus(
        "error",
        "Error in video processing: " + err.message + ". Reinitializing..."
      );
    } else {
      document.getElementById("statusMessage").textContent =
        "Error in video processing: " + err.message + ". Reinitializing...";
    }

    // Try to reinitialize on error
    setTimeout(() => {
      initializeVideoProcessing();
    }, 1000);
  }

  // Continue processing if streaming is still active
  if (streaming) {
    requestAnimationFrame(processVideo);
  }
}

// Utility class for loading external files
class Utils {
  constructor(errorOutputId) {
    this.errorOutput = document.getElementById(errorOutputId);
  }

  createFileFromUrl(path, url, callback) {
    let request = new XMLHttpRequest();
    request.open("GET", url, true);
    request.responseType = "arraybuffer";
    request.onload = function (ev) {
      if (request.readyState === 4) {
        if (request.status === 200) {
          let data = new Uint8Array(request.response);
          cv.FS_createDataFile("/", path, data, true, false, false);
          callback();
        } else {
          this.errorOutput.textContent =
            "Failed to load " + url + " status: " + request.status;
        }
      }
    };
    request.send();
  }
}
