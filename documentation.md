# Real-time Face Swapping Web Application Documentation

## Overview
This documentation provides comprehensive information about the Real-time Face Swapping Web Application. The application allows users to replace their face in a webcam stream with a face from an uploaded image in real-time, using OpenCV.js for face detection and image processing.

## Features
- Real-time webcam access using WebRTC
- Face detection using OpenCV.js and Haar cascades
- Face swapping with uploaded images
- Adjustable settings for blending and smoothing
- Image capture and download capabilities
- Responsive design for various screen sizes

## Technical Architecture
The application is built entirely as a client-side web application using the following technologies:
- HTML5, CSS3, and JavaScript for the user interface
- WebRTC for accessing the user's webcam
- OpenCV.js for face detection and image processing
- Font Awesome for icons and visual elements

### Components
1. **Webcam Access Module**: Handles webcam stream access using WebRTC
2. **Face Detection Module**: Detects faces in the webcam stream using Haar cascades
3. **Face Swapping Algorithm**: Performs face extraction, alignment, warping, and blending
4. **User Interface**: Provides controls and visual feedback to the user

## Installation and Setup

### Prerequisites
- A modern web browser (Chrome, Firefox, Edge, or Safari)
- A webcam
- A web server to host the application files

### Local Development Setup
1. Clone or download the application files
2. Navigate to the application directory
3. Start a local web server (e.g., `python -m http.server 8000`)
4. Access the application at `http://localhost:8000`

### Deployment
The application can be deployed to any web hosting service that supports static websites. Ensure that the hosting service provides HTTPS, as webcam access requires a secure context.

## Usage Guide

### Getting Started
1. Allow webcam access when prompted by the browser
2. Upload a face image using the "Choose Image" button
3. Once a face is detected in the uploaded image, click "Start Face Swap"
4. The application will detect faces in the webcam feed and swap them with the uploaded face
5. Use the settings panel to adjust blending strength and smoothing for better results
6. Capture images of the face swapping results using the "Capture" button

### Settings
- **Blending Strength**: Controls how strongly the swapped face is blended with the original face
- **Face Smoothing**: Applies smoothing to the swapped face for a more natural look
- **Show Face Detection Box**: Toggles the visibility of face detection rectangles

### Troubleshooting
- **No webcam access**: Ensure your browser has permission to access the webcam
- **Poor face detection**: Ensure adequate lighting and face visibility
- **Performance issues**: Close other browser tabs or applications to free up resources

## Technical Details

### Face Detection
The application uses Haar cascade classifiers from OpenCV to detect faces in the webcam stream. The detection process includes:
1. Converting the video frame to grayscale
2. Applying histogram equalization to improve detection in different lighting conditions
3. Using the `detectMultiScale` method with optimized parameters
4. Throttling detection to improve performance

### Face Swapping Algorithm
The face swapping process involves several steps:
1. **Face Extraction**: Extracting the face region from the uploaded image
2. **Face Alignment**: Resizing and aligning the source face to match the target face
3. **Face Blending**: Creating a seamless blend between the source face and the target face
4. **Color Correction**: Adjusting color tones to match the target face

### Performance Optimization
- Detection throttling to reduce CPU usage
- Adjustable smoothing parameters for performance tuning
- Efficient memory management with proper cleanup of OpenCV resources

## File Structure
```
face-swap-app/
├── index.html              # Main HTML file
├── css/
│   └── styles.css          # CSS styles
├── js/
│   ├── app.js              # Main application logic
│   ├── face-swap.js        # Face swapping algorithm
│   └── ui.js               # UI enhancement script
├── models/
│   └── haarcascade_frontalface_default.xml  # Face detection model
└── assets/                 # Application assets
```

## Browser Compatibility
- Chrome 60+
- Firefox 55+
- Edge 79+
- Safari 11+

## Security Considerations
- The application processes all data locally in the browser
- No data is sent to external servers
- Webcam access requires user permission and a secure context (HTTPS)

## License
This application is provided under the MIT License.

## Acknowledgments
- OpenCV.js for computer vision capabilities
- WebRTC for webcam access functionality
