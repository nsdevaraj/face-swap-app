// UI enhancement script for the face swapping application

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const webcamOverlay = document.getElementById('webcamOverlay');
    const outputOverlay = document.getElementById('outputOverlay');
    const fileInput = document.getElementById('faceUpload');
    const fileName = document.getElementById('fileName');
    const captureButton = document.getElementById('captureButton');
    const settingsPanel = document.getElementById('settingsPanel');
    const toggleSettings = document.getElementById('toggleSettings');
    const blendingSlider = document.getElementById('blendingSlider');
    const blendingValue = document.getElementById('blendingValue');
    const smoothingSlider = document.getElementById('smoothingSlider');
    const smoothingValue = document.getElementById('smoothingValue');
    const showFaceBox = document.getElementById('showFaceBox');
    const aboutLink = document.getElementById('aboutLink');
    const helpLink = document.getElementById('helpLink');
    const infoModal = document.getElementById('infoModal');
    const modalContent = document.getElementById('modalContent');
    const closeModal = document.querySelector('.close-modal');
    const statusIcon = document.getElementById('statusIcon');
    const galleryContainer = document.getElementById('galleryContainer');
    
    // Global variables
    let blendingStrength = 80;
    let smoothingAmount = 50;
    let showFaceBoxes = true;
    let capturedImages = [];
    
    // Initialize UI
    initializeUI();
    
    // Function to initialize UI elements
    function initializeUI() {
        // Hide settings panel by default
        settingsPanel.style.display = 'none';
        
        // Set up event listeners
        setupEventListeners();
        
        // Update slider values
        updateSliderValues();
    }
    
    // Set up event listeners for UI elements
    function setupEventListeners() {
        // File input change
        fileInput.addEventListener('change', handleFileNameDisplay);
        
        // Capture button
        captureButton.addEventListener('click', captureImage);
        
        // Settings toggle
        toggleSettings.addEventListener('click', function(e) {
            e.preventDefault();
            toggleSettingsPanel();
        });
        
        // Sliders
        blendingSlider.addEventListener('input', function() {
            blendingStrength = this.value;
            blendingValue.textContent = `${blendingStrength}%`;
            updateFaceSwapSettings();
        });
        
        smoothingSlider.addEventListener('input', function() {
            smoothingAmount = this.value;
            smoothingValue.textContent = `${smoothingAmount}%`;
            updateFaceSwapSettings();
        });
        
        // Checkbox
        showFaceBox.addEventListener('change', function() {
            showFaceBoxes = this.checked;
            updateFaceSwapSettings();
        });
        
        // Modal links
        aboutLink.addEventListener('click', function(e) {
            e.preventDefault();
            showAboutModal();
        });
        
        helpLink.addEventListener('click', function(e) {
            e.preventDefault();
            showHelpModal();
        });
        
        // Close modal
        closeModal.addEventListener('click', function() {
            infoModal.style.display = 'none';
        });
        
        // Close modal when clicking outside
        window.addEventListener('click', function(e) {
            if (e.target === infoModal) {
                infoModal.style.display = 'none';
            }
        });
    }
    
    // Handle file name display
    function handleFileNameDisplay() {
        if (fileInput.files.length > 0) {
            fileName.textContent = fileInput.files[0].name;
        } else {
            fileName.textContent = 'No file selected';
        }
    }
    
    // Toggle settings panel
    function toggleSettingsPanel() {
        if (settingsPanel.style.display === 'none') {
            settingsPanel.style.display = 'block';
        } else {
            settingsPanel.style.display = 'none';
        }
    }
    
    // Update slider values
    function updateSliderValues() {
        blendingValue.textContent = `${blendingStrength}%`;
        smoothingValue.textContent = `${smoothingAmount}%`;
    }
    
    // Update face swap settings
    function updateFaceSwapSettings() {
        // This function will be called when settings are changed
        // The main app.js will access these values via the global variables
        // or we can implement a callback system if needed
        
        // For now, just log the changes
        console.log('Face swap settings updated:');
        console.log('Blending strength:', blendingStrength);
        console.log('Smoothing amount:', smoothingAmount);
        console.log('Show face boxes:', showFaceBoxes);
    }
    
    // Capture current output image
    function captureImage() {
        const canvas = document.getElementById('outputCanvas');
        if (!canvas) return;
        
        try {
            // Get image data from canvas
            const imageData = canvas.toDataURL('image/png');
            
            // Add to captured images array
            capturedImages.push(imageData);
            
            // Update gallery
            updateGallery();
            
            // Show success message
            updateStatus('success', 'Image captured successfully!');
            
            // Enable download if this is the first capture
            if (capturedImages.length === 1) {
                updateGalleryEmptyState();
            }
        } catch (error) {
            console.error('Error capturing image:', error);
            updateStatus('error', 'Failed to capture image');
        }
    }
    
    // Update gallery with captured images
    function updateGallery() {
        // Clear empty state if needed
        updateGalleryEmptyState();
        
        // Create gallery item for the latest image
        const latestImage = capturedImages[capturedImages.length - 1];
        const galleryItem = createGalleryItem(latestImage, capturedImages.length - 1);
        
        // Add to gallery container
        galleryContainer.appendChild(galleryItem);
    }
    
    // Create gallery item element
    function createGalleryItem(imageData, index) {
        const item = document.createElement('div');
        item.className = 'gallery-item';
        
        // Create image
        const img = document.createElement('img');
        img.src = imageData;
        img.alt = `Captured image ${index + 1}`;
        
        // Create actions
        const actions = document.createElement('div');
        actions.className = 'gallery-actions';
        
        // Download link
        const downloadLink = document.createElement('a');
        downloadLink.href = '#';
        downloadLink.innerHTML = '<i class="fas fa-download"></i>';
        downloadLink.title = 'Download image';
        downloadLink.addEventListener('click', function(e) {
            e.preventDefault();
            downloadImage(imageData, `face-swap-${index + 1}.png`);
        });
        
        // Delete link
        const deleteLink = document.createElement('a');
        deleteLink.href = '#';
        deleteLink.innerHTML = '<i class="fas fa-trash"></i>';
        deleteLink.title = 'Delete image';
        deleteLink.addEventListener('click', function(e) {
            e.preventDefault();
            deleteGalleryItem(index, item);
        });
        
        // Add actions to item
        actions.appendChild(downloadLink);
        actions.appendChild(deleteLink);
        
        // Add elements to item
        item.appendChild(img);
        item.appendChild(actions);
        
        return item;
    }
    
    // Download image
    function downloadImage(imageData, fileName) {
        const link = document.createElement('a');
        link.href = imageData;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    // Delete gallery item
    function deleteGalleryItem(index, itemElement) {
        // Remove from array
        capturedImages.splice(index, 1);
        
        // Remove from DOM
        itemElement.remove();
        
        // Update empty state if needed
        updateGalleryEmptyState();
        
        // Show message
        updateStatus('info', 'Image deleted');
    }
    
    // Update gallery empty state
    function updateGalleryEmptyState() {
        if (capturedImages.length === 0) {
            galleryContainer.innerHTML = '<p class="empty-gallery">No images captured yet</p>';
        } else {
            // Remove empty message if it exists
            const emptyMessage = galleryContainer.querySelector('.empty-gallery');
            if (emptyMessage) {
                emptyMessage.remove();
            }
        }
    }
    
    // Show about modal
    function showAboutModal() {
        modalContent.innerHTML = `
            <h2><i class="fas fa-info-circle"></i> About Face Swapping App</h2>
            <p>This real-time face swapping web application allows you to replace your face in a webcam stream with a face from an uploaded image.</p>
            <p>The application uses OpenCV.js for face detection and image processing, and runs entirely in your browser without sending any data to external servers.</p>
            <h3>Features:</h3>
            <ul>
                <li>Real-time face detection using Haar cascades</li>
                <li>Face swapping with uploaded images</li>
                <li>Adjustable blending and smoothing settings</li>
                <li>Image capture and download capabilities</li>
            </ul>
            <p>Version 1.0.0</p>
        `;
        infoModal.style.display = 'block';
    }
    
    // Show help modal
    function showHelpModal() {
        modalContent.innerHTML = `
            <h2><i class="fas fa-question-circle"></i> How to Use</h2>
            <ol>
                <li>Allow webcam access when prompted</li>
                <li>Upload a face image using the "Choose Image" button</li>
                <li>Click "Start Face Swap" to begin the face swapping process</li>
                <li>Adjust settings as needed for better results</li>
                <li>Use the "Capture" button to save the current frame</li>
                <li>Click "Stop" to pause face swapping</li>
            </ol>
            <h3>Troubleshooting:</h3>
            <ul>
                <li><strong>No face detected:</strong> Make sure your face is clearly visible and well-lit</li>
                <li><strong>Poor swapping results:</strong> Try adjusting the blending and smoothing settings</li>
                <li><strong>Performance issues:</strong> Close other browser tabs or applications</li>
            </ul>
        `;
        infoModal.style.display = 'block';
    }
    
    // Update status message with icon
    function updateStatus(type, message) {
        const statusMessage = document.getElementById('statusMessage');
        
        // Update message
        statusMessage.textContent = message;
        
        // Update icon
        switch (type) {
            case 'success':
                statusIcon.className = 'fas fa-check-circle';
                statusIcon.style.color = 'var(--success-color)';
                break;
            case 'warning':
                statusIcon.className = 'fas fa-exclamation-triangle';
                statusIcon.style.color = 'var(--warning-color)';
                break;
            case 'error':
                statusIcon.className = 'fas fa-times-circle';
                statusIcon.style.color = 'var(--danger-color)';
                break;
            case 'info':
            default:
                statusIcon.className = 'fas fa-info-circle';
                statusIcon.style.color = 'var(--info-color)';
                break;
        }
        
        // Reset after 3 seconds
        setTimeout(() => {
            if (statusMessage.textContent === message) {
                statusMessage.textContent = 'Ready';
                statusIcon.className = 'fas fa-info-circle';
                statusIcon.style.color = 'var(--info-color)';
            }
        }, 3000);
    }
    
    // Public API for other scripts to access
    window.FaceSwapUI = {
        updateStatus: updateStatus,
        getBlendingStrength: () => blendingStrength,
        getSmoothing: () => smoothingAmount,
        getShowFaceBoxes: () => showFaceBoxes,
        hideWebcamOverlay: () => { webcamOverlay.style.display = 'none'; },
        showWebcamOverlay: () => { webcamOverlay.style.display = 'flex'; },
        hideOutputOverlay: () => { outputOverlay.style.display = 'none'; },
        showOutputOverlay: () => { outputOverlay.style.display = 'flex'; },
        enableCaptureButton: () => { captureButton.disabled = false; },
        disableCaptureButton: () => { captureButton.disabled = true; }
    };
});
