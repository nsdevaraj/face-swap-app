// Face swapping algorithm implementation
// This file contains functions for face extraction, alignment, warping, and blending

// Global variables for face swapping
let sourceFace = null; // Extracted face from uploaded image
let sourceMask = null; // Mask for the source face
let sourceWarped = null; // Warped source face to match target face
let resultMat = null; // Result of face swapping

// Extract face from the uploaded image
function extractFaceFromUploadedImage(uploadedImage, faceRect) {
    try {
        // Validate inputs
        if (!uploadedImage || !faceRect) {
            console.error('Invalid inputs to extractFaceFromUploadedImage');
            return null;
        }
        
        // Ensure face rectangle is within image bounds
        let x = Math.max(0, faceRect.x);
        let y = Math.max(0, faceRect.y);
        let width = Math.min(faceRect.width, uploadedImage.cols - x);
        let height = Math.min(faceRect.height, uploadedImage.rows - y);
        
        // Create a region of interest (ROI) for the face
        let faceROI = new cv.Rect(x, y, width, height);
        
        // Extract the face region
        let extractedFace = new cv.Mat();
        let roi = new cv.Mat(uploadedImage, faceROI);
        roi.copyTo(extractedFace);
        
        // Create a mask for the face using a different approach to avoid constructor issues
        // First create a ones matrix and then set all values to zero
        let mask = new cv.Mat();
        mask = cv.Mat.ones(extractedFace.rows, extractedFace.cols, cv.CV_8UC1);
        mask.setTo(new cv.Scalar(0));
        
        // Get dimensions for ellipse
        let center = new cv.Point(extractedFace.cols / 2, extractedFace.rows / 2);
        let axes = new cv.Point(extractedFace.cols * 0.4, extractedFace.rows * 0.45);
        
        // Draw ellipse on the mask
        cv.ellipse(mask, center, axes, 0, 0, 360, new cv.Scalar(255), -1);
        
        // Apply some feathering to the mask edges for smoother blending
        let featheredMask = new cv.Mat();
        cv.GaussianBlur(mask, featheredMask, new cv.Size(15, 15), 0, 0);
        
        // Clean up
        roi.delete();
        mask.delete();
        
        return {
            face: extractedFace,
            mask: featheredMask
        };
    } catch (error) {
        console.error('Error in extractFaceFromUploadedImage:', error);
        return null;
    }
}

// Resize and align source face to match target face
function alignFace(sourceFace, sourceMask, targetFaceRect) {
    try {
        // Validate inputs
        if (!sourceFace || !sourceMask || !targetFaceRect) {
            console.error('Invalid inputs to alignFace');
            return null;
        }
        
        // Create a resized version of the source face to match target face dimensions
        let resizedFace = new cv.Mat();
        let resizedMask = new cv.Mat();
        
        // Ensure target dimensions are valid
        let width = Math.max(1, targetFaceRect.width);
        let height = Math.max(1, targetFaceRect.height);
        
        // Resize source face to match target face dimensions
        cv.resize(
            sourceFace,
            resizedFace,
            new cv.Size(width, height),
            0,
            0,
            cv.INTER_LINEAR
        );
        
        // Resize source mask to match target face dimensions
        cv.resize(
            sourceMask,
            resizedMask,
            new cv.Size(width, height),
            0,
            0,
            cv.INTER_LINEAR
        );
        
        return {
            face: resizedFace,
            mask: resizedMask
        };
    } catch (error) {
        console.error('Error in alignFace:', error);
        return null;
    }
}

// Blend the warped source face onto the target frame
function blendFaces(targetFrame, warpedFace, warpedMask, targetFaceRect) {
    try {
        // Validate inputs
        if (!targetFrame || !warpedFace || !warpedMask || !targetFaceRect) {
            console.error('Invalid inputs to blendFaces');
            return targetFrame.clone();
        }
        
        // Create a copy of the target frame
        let result = targetFrame.clone();
        
        // Ensure face rectangle is within frame bounds
        let x = Math.max(0, targetFaceRect.x);
        let y = Math.max(0, targetFaceRect.y);
        let width = Math.min(targetFaceRect.width, result.cols - x);
        let height = Math.min(targetFaceRect.height, result.rows - y);
        
        // Skip if dimensions are invalid
        if (width <= 0 || height <= 0) {
            console.warn('Invalid face rectangle dimensions');
            return result;
        }
        
        // Create a region of interest (ROI) in the result image
        let roi = new cv.Mat(
            result,
            new cv.Rect(x, y, width, height)
        );
        
        // Ensure warped face and mask dimensions match ROI
        if (warpedFace.rows !== height || warpedFace.cols !== width ||
            warpedMask.rows !== height || warpedMask.cols !== width) {
            console.warn('Dimension mismatch in blendFaces, resizing warped face and mask');
            
            let resizedFace = new cv.Mat();
            let resizedMask = new cv.Mat();
            
            cv.resize(warpedFace, resizedFace, new cv.Size(width, height));
            cv.resize(warpedMask, resizedMask, new cv.Size(width, height));
            
            // Use the resized versions
            warpedFace = resizedFace;
            warpedMask = resizedMask;
        }
        
        // Create temporary matrices for blending
        let foreground = new cv.Mat();
        let background = new cv.Mat();
        let maskInv = new cv.Mat();
        
        // Convert mask to 3-channel for multiplication
        let mask3C = new cv.Mat();
        cv.cvtColor(warpedMask, mask3C, cv.COLOR_GRAY2RGBA);
        
        // Normalize mask values from 0-255 to 0-1
        mask3C.convertTo(mask3C, cv.CV_32FC4, 1/255);
        
        // Convert source and target to floating point for blending
        warpedFace.convertTo(foreground, cv.CV_32FC4);
        roi.convertTo(background, cv.CV_32FC4);
        
        // Invert mask for background
        cv.subtract(new cv.Scalar(1, 1, 1, 1), mask3C, maskInv);
        
        // Multiply foreground and background by respective masks
        let maskedFg = new cv.Mat();
        let maskedBg = new cv.Mat();
        
        cv.multiply(foreground, mask3C, maskedFg);
        cv.multiply(background, maskInv, maskedBg);
        
        // Add the masked foreground and background
        let blended = new cv.Mat();
        cv.add(maskedFg, maskedBg, blended);
        
        // Convert back to 8-bit
        blended.convertTo(blended, cv.CV_8UC4);
        
        // Copy the blended result back to the ROI
        blended.copyTo(roi);
        
        // Clean up
        roi.delete();
        foreground.delete();
        background.delete();
        mask3C.delete();
        maskInv.delete();
        maskedFg.delete();
        maskedBg.delete();
        blended.delete();
        
        // Clean up resized versions if created
        if (warpedFace !== warpedFace) warpedFace.delete();
        if (warpedMask !== warpedMask) warpedMask.delete();
        
        return result;
    } catch (error) {
        console.error('Error in blendFaces:', error);
        return targetFrame.clone();
    }
}

// Main face swapping function
function swapFaces(sourceImage, targetFrame, targetFaces) {
    try {
        // Validate inputs
        if (!sourceImage || !targetFrame || !targetFaces) {
            console.error('Invalid inputs to swapFaces');
            return targetFrame.clone();
        }
        
        // If no faces detected in target, return original frame
        if (targetFaces.size() === 0) {
            return targetFrame.clone();
        }
        
        // Detect faces in source image if not already done
        if (!sourceFace || !sourceMask) {
            let sourceGray = new cv.Mat();
            let sourceFaces = new cv.RectVector();
            
            // Convert to grayscale for face detection
            cv.cvtColor(sourceImage, sourceGray, cv.COLOR_RGBA2GRAY);
            
            // Detect faces in the source image
            faceCascade.detectMultiScale(sourceGray, sourceFaces, 1.1, 3, 0);
            
            // If no faces detected in source, return original frame
            if (sourceFaces.size() === 0) {
                sourceGray.delete();
                sourceFaces.delete();
                return targetFrame.clone();
            }
            
            // Extract the first face from source image
            let sourceFaceRect = sourceFaces.get(0);
            let extracted = extractFaceFromUploadedImage(sourceImage, sourceFaceRect);
            
            // If extraction failed, return original frame
            if (!extracted) {
                sourceGray.delete();
                sourceFaces.delete();
                return targetFrame.clone();
            }
            
            // Store the extracted face and mask
            sourceFace = extracted.face;
            sourceMask = extracted.mask;
            
            // Clean up
            sourceGray.delete();
            sourceFaces.delete();
        }
        
        // Get the first face from target frame
        let targetFaceRect = targetFaces.get(0);
        
        // Align source face to target face
        let aligned = alignFace(sourceFace, sourceMask, targetFaceRect);
        
        // If alignment failed, return original frame
        if (!aligned) {
            return targetFrame.clone();
        }
        
        // Blend the aligned face onto the target frame
        let result = blendFaces(targetFrame, aligned.face, aligned.mask, targetFaceRect);
        
        // Clean up
        aligned.face.delete();
        aligned.mask.delete();
        
        return result;
        
    } catch (error) {
        console.error('Error in swapFaces:', error);
        return targetFrame.clone();
    }
}

// Color correction to match skin tones
function colorCorrectFace(sourceFace, targetFace) {
    try {
        // Validate inputs
        if (!sourceFace || !targetFace) {
            console.error('Invalid inputs to colorCorrectFace');
            return sourceFace.clone();
        }
        
        // Convert to LAB color space for better color matching
        let sourceLab = new cv.Mat();
        let targetLab = new cv.Mat();
        
        cv.cvtColor(sourceFace, sourceLab, cv.COLOR_RGBA2RGB);
        cv.cvtColor(targetFace, targetLab, cv.COLOR_RGBA2RGB);
        
        cv.cvtColor(sourceLab, sourceLab, cv.COLOR_RGB2Lab);
        cv.cvtColor(targetLab, targetLab, cv.COLOR_RGB2Lab);
        
        // Split the LAB channels
        let sourceChannels = new cv.MatVector();
        let targetChannels = new cv.MatVector();
        
        cv.split(sourceLab, sourceChannels);
        cv.split(targetLab, targetChannels);
        
        // Calculate mean and standard deviation for L, a, b channels
        let sourceMean = new cv.Mat();
        let sourceStdDev = new cv.Mat();
        let targetMean = new cv.Mat();
        let targetStdDev = new cv.Mat();
        
        cv.meanStdDev(sourceChannels.get(0), sourceMean, sourceStdDev);
        cv.meanStdDev(targetChannels.get(0), targetMean, targetStdDev);
        
        // Adjust L channel (luminance)
        let adjustedL = new cv.Mat();
        cv.subtract(sourceChannels.get(0), new cv.Scalar(sourceMean.data64F[0]), adjustedL);
        cv.multiply(adjustedL, new cv.Scalar(targetStdDev.data64F[0] / sourceStdDev.data64F[0]), adjustedL);
        cv.add(adjustedL, new cv.Scalar(targetMean.data64F[0]), adjustedL);
        
        // Create adjusted LAB image
        let adjustedLab = new cv.Mat();
        let adjustedChannels = new cv.MatVector();
        adjustedChannels.push_back(adjustedL);
        adjustedChannels.push_back(targetChannels.get(1)); // Use target a channel
        adjustedChannels.push_back(targetChannels.get(2)); // Use target b channel
        
        cv.merge(adjustedChannels, adjustedLab);
        
        // Convert back to RGB
        let adjustedRgb = new cv.Mat();
        cv.cvtColor(adjustedLab, adjustedRgb, cv.COLOR_Lab2RGB);
        cv.cvtColor(adjustedRgb, adjustedRgb, cv.COLOR_RGB2RGBA);
        
        // Clean up
        sourceLab.delete();
        targetLab.delete();
        sourceChannels.delete();
        targetChannels.delete();
        sourceMean.delete();
        sourceStdDev.delete();
        targetMean.delete();
        targetStdDev.delete();
        adjustedL.delete();
        adjustedLab.delete();
        adjustedChannels.delete();
        
        return adjustedRgb;
    } catch (error) {
        console.error('Error in colorCorrectFace:', error);
        return sourceFace.clone();
    }
}
