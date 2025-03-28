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
    console.log("Starting face extraction from uploaded image");

    // Validate inputs
    if (!uploadedImage || !faceRect) {
      console.error("Invalid inputs to extractFaceFromUploadedImage");
      return null;
    }

    // Get dimensions from the face rectangle (with improved margin for better feature capture)
    const margin = 0.25; // 25% margin around the face to ensure all features are captured
    const width = faceRect.width;
    const height = faceRect.height;

    // Calculate coordinates with margin
    let x = Math.max(0, faceRect.x - Math.floor(width * margin));
    let y = Math.max(0, faceRect.y - Math.floor(height * margin));
    let w = Math.min(
      uploadedImage.cols - x,
      Math.floor(width * (1 + 2 * margin))
    );
    let h = Math.min(
      uploadedImage.rows - y,
      Math.floor(height * (1 + 2 * margin))
    );

    // Create rectangle for region of interest
    let rect = new cv.Rect(x, y, w, h);

    // Extract face region from uploaded image
    let extractedFace = uploadedImage.roi(rect).clone();

    // Convert extracted face to RGBA if it's not already
    if (extractedFace.channels() === 3) {
      let rgbaFace = new cv.Mat();
      cv.cvtColor(extractedFace, rgbaFace, cv.COLOR_RGB2RGBA);
      extractedFace.delete();
      extractedFace = rgbaFace;
    }

    // Enhance the extracted face to emphasize facial features
    let enhancedFace = new cv.Mat();
    let grayFace = new cv.Mat();

    // Convert to grayscale for feature detection
    cv.cvtColor(extractedFace, grayFace, cv.COLOR_RGBA2GRAY);

    // Enhance contrast using CLAHE
    let clahe = new cv.CLAHE(3.0, new cv.Size(8, 8));
    let enhancedGray = new cv.Mat();
    clahe.apply(grayFace, enhancedGray);

    // Detect edges for facial features
    let edges = new cv.Mat();
    cv.Canny(enhancedGray, edges, 30, 120);

    // Use morphological operations to refine facial feature detection
    let featureKernel = cv.Mat.ones(2, 2, cv.CV_8U);
    let featuresRefined = new cv.Mat();

    // Close small gaps in feature edges
    cv.morphologyEx(edges, featuresRefined, cv.MORPH_CLOSE, featureKernel);

    // Dilate to create more prominent feature areas
    let featuresMask = new cv.Mat();
    cv.dilate(
      featuresRefined,
      featuresMask,
      featureKernel,
      new cv.Point(-1, -1),
      1
    );

    // Create a mask for the face with an improved shape that better matches facial contours
    // Start with an elliptical mask as the base
    let mask = new cv.Mat.zeros(h, w, cv.CV_8UC1);

    // Calculate ellipse dimensions and position for a better face shape
    let centerX = Math.floor(w / 2);
    let centerY = Math.floor(h / 2);
    let center = new cv.Point(centerX, centerY);

    // Adjust the axes for a more natural face shape (slightly wider in the middle)
    let axesX = Math.floor(w / 2.1); // Slightly larger horizontally
    let axesY = Math.floor(h / 2.1);
    let axes = new cv.Size(axesX, axesY);

    let angle = 0;
    let startAngle = 0;
    let endAngle = 360;
    let color = new cv.Scalar(255); // White
    let thickness = -1; // Fill the ellipse

    // Draw elliptical mask
    cv.ellipse(
      mask,
      center,
      axes,
      angle,
      startAngle,
      endAngle,
      color,
      thickness
    );

    // Expand the mask in the chin area to better match human face shape
    // Define chin region (bottom third of the face)
    let chinRegionY = centerY + Math.floor(axesY * 0.3);
    let chinWidth = Math.floor(axesX * 0.8);

    // Draw additional shape for chin area
    let chinPts = new cv.MatVector();
    let chinContour = new cv.Mat(6, 1, cv.CV_32SC2);

    // Define the chin shape points
    chinContour.data32S[0] = centerX - chinWidth; // Bottom left
    chinContour.data32S[1] = chinRegionY;
    chinContour.data32S[2] = centerX; // Bottom middle
    chinContour.data32S[3] = Math.min(
      h - 1,
      chinRegionY + Math.floor(axesY * 0.4)
    );
    chinContour.data32S[4] = centerX + chinWidth; // Bottom right
    chinContour.data32S[5] = chinRegionY;
    chinContour.data32S[6] = centerX + chinWidth; // Right
    chinContour.data32S[7] = chinRegionY;
    chinContour.data32S[8] = centerX - chinWidth; // Left
    chinContour.data32S[9] = chinRegionY;
    chinContour.data32S[10] = centerX - chinWidth; // Close the contour
    chinContour.data32S[11] = chinRegionY;

    chinPts.push_back(chinContour);
    cv.fillPoly(mask, chinPts, color);

    // Apply some blur to the mask edges for better blending
    cv.GaussianBlur(mask, mask, new cv.Size(21, 21), 11, 11);

    // Combine the mask with detected facial features to ensure important features are preserved
    let combinedMask = new cv.Mat();
    cv.bitwise_or(mask, featuresMask, combinedMask);

    // Smooth the final mask
    let finalMask = new cv.Mat();
    cv.GaussianBlur(combinedMask, finalMask, new cv.Size(7, 7), 3, 3);

    // Apply the mask to the face to create transparency
    let srcChannels = new cv.MatVector();
    cv.split(extractedFace, srcChannels);

    // Make sure we have 4 channels
    if (srcChannels.size() === 4) {
      // Replace alpha channel with our enhanced mask
      finalMask.copyTo(srcChannels.get(3));

      // Merge channels back
      let result = new cv.Mat();
      cv.merge(srcChannels, result);
      console.log("Applied enhanced mask to alpha channel");

      // Clean up
      srcChannels.delete();
      extractedFace.delete();
      grayFace.delete();
      clahe.delete();
      enhancedGray.delete();
      edges.delete();
      featureKernel.delete();
      featuresRefined.delete();
      featuresMask.delete();
      combinedMask.delete();
      chinPts.delete();
      chinContour.delete();

      console.log(
        "Successfully extracted face with improved feature detection",
        w,
        "x",
        h
      );

      return {
        face: result,
        mask: finalMask,
      };
    } else {
      console.error("Expected 4 channels but got", srcChannels.size());
      srcChannels.delete();
      return null;
    }
  } catch (error) {
    console.error("Error in extractFaceFromUploadedImage:", error);
    return null;
  }
}

// Resize and align source face to match target face
function alignFace(sourceFace, sourceMask, targetFaceRect) {
  try {
    // Validate inputs
    if (!sourceFace || !sourceMask || !targetFaceRect) {
      console.error("Invalid inputs to alignFace");
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

    // Apply additional processing to enhance the facial features
    // Apply adaptive sharpening to preserve facial feature details
    let sharpenKernel = new cv.Mat(3, 3, cv.CV_32FC1);
    let sharpenData = sharpenKernel.data32F;
    sharpenData[0] = 0;
    sharpenData[1] = -1;
    sharpenData[2] = 0;
    sharpenData[3] = -1;
    sharpenData[4] = 5;
    sharpenData[5] = -1;
    sharpenData[6] = 0;
    sharpenData[7] = -1;
    sharpenData[8] = 0;

    // Create a sharpened version of the face
    let sharpened = new cv.Mat();
    cv.filter2D(
      resizedFace,
      sharpened,
      -1,
      sharpenKernel,
      new cv.Point(-1, -1),
      0,
      cv.BORDER_DEFAULT
    );

    // Blend the original with the sharpened version for a more natural look
    let alpha = 0.7; // Adjust this value to control sharpening intensity
    let beta = 1.0 - alpha;
    let enhancedFace = new cv.Mat();
    cv.addWeighted(resizedFace, alpha, sharpened, beta, 0, enhancedFace);

    // Clean up temporary matrices
    sharpenKernel.delete();
    sharpened.delete();
    resizedFace.delete();

    return {
      face: enhancedFace,
      mask: resizedMask,
    };
  } catch (error) {
    console.error("Error in alignFace:", error);
    return null;
  }
}

// Blend the warped source face onto the target frame with interlacing
function blendFaces(targetFrame, warpedFace, warpedMask, targetFaceRect) {
  try {
    // Validate inputs
    if (!targetFrame || !warpedFace || !warpedMask || !targetFaceRect) {
      console.error("Invalid inputs to blendFaces");
      return targetFrame.clone();
    }

    // Create a copy of the target frame
    let result = targetFrame.clone();

    // Declare variables
    let resizedFace = null;
    let resizedMask = null;

    // Ensure face rectangle is within frame bounds
    let x = Math.max(0, targetFaceRect.x);
    let y = Math.max(0, targetFaceRect.y);
    let width = Math.min(targetFaceRect.width, result.cols - x);
    let height = Math.min(targetFaceRect.height, result.rows - y);

    // Skip if dimensions are invalid
    if (width <= 0 || height <= 0) {
      console.warn("Invalid face rectangle dimensions");
      return result;
    }

    // Extract the ROI
    let rect = new cv.Rect(x, y, width, height);
    let roi = result.roi(rect);

    // Extract the target face region
    let targetFaceRegion = roi.clone();

    // Ensure warped face dimensions match
    if (
      warpedFace.rows !== height ||
      warpedFace.cols !== width ||
      warpedMask.rows !== height ||
      warpedMask.cols !== width
    ) {
      resizedFace = new cv.Mat();
      resizedMask = new cv.Mat();
      cv.resize(warpedFace, resizedFace, new cv.Size(width, height));
      cv.resize(warpedMask, resizedMask, new cv.Size(width, height));
      warpedFace = resizedFace;
      warpedMask = resizedMask;
    }

    // Convert to grayscale for feature detection
    let graySource = new cv.Mat();
    let grayTarget = new cv.Mat();
    cv.cvtColor(warpedFace, graySource, cv.COLOR_RGBA2GRAY);
    cv.cvtColor(targetFaceRegion, grayTarget, cv.COLOR_RGBA2GRAY);

    // Apply CLAHE for better feature contrast
    let clahe = new cv.CLAHE(3.0, new cv.Size(8, 8));
    let enhancedSource = new cv.Mat();
    let enhancedTarget = new cv.Mat();
    clahe.apply(graySource, enhancedSource);
    clahe.apply(grayTarget, enhancedTarget);

    // Detect features using Canny edge detection
    let sourceEdges = new cv.Mat();
    let targetEdges = new cv.Mat();
    cv.Canny(enhancedSource, sourceEdges, 30, 120);
    cv.Canny(enhancedTarget, targetEdges, 30, 120);

    // Create feature masks
    let sourceMorphKernel = cv.Mat.ones(2, 2, cv.CV_8U);
    let targetMorphKernel = cv.Mat.ones(2, 2, cv.CV_8U);

    let sourceFeatures = new cv.Mat();
    let targetFeatures = new cv.Mat();

    // Dilate to connect nearby features
    cv.dilate(
      sourceEdges,
      sourceFeatures,
      sourceMorphKernel,
      new cv.Point(-1, -1),
      1
    );
    cv.dilate(
      targetEdges,
      targetFeatures,
      targetMorphKernel,
      new cv.Point(-1, -1),
      1
    );

    // Create an improved interlaced pattern based on feature locations
    // The goal is to preserve source features where important and blend with target elsewhere
    let featureBasedPattern = new cv.Mat(
      height,
      width,
      cv.CV_32FC1,
      new cv.Scalar(0)
    );

    // Convert feature masks to proper format
    let sourceFeaturesMask = new cv.Mat();
    let targetFeaturesMask = new cv.Mat();
    sourceFeatures.convertTo(sourceFeaturesMask, cv.CV_32FC1, 1.0 / 255.0);
    targetFeatures.convertTo(targetFeaturesMask, cv.CV_32FC1, 1.0 / 255.0);

    // Create base stripe pattern for non-feature areas
    const stripeWidth = 3; // Width of each stripe in pixels
    for (let y = 0; y < height; y++) {
      if (Math.floor(y / stripeWidth) % 2 === 0) {
        for (let x = 0; x < width; x++) {
          if (sourceFeaturesMask.floatPtr(y, x)[0] < 0.5) {
            // Not a strong feature
            featureBasedPattern.floatPtr(y, x)[0] = 0.7; // Moderate strength for stripes
          }
        }
      }
    }

    // Add source features more strongly
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (sourceFeaturesMask.floatPtr(y, x)[0] > 0.5) {
          // Feature found - use full strength
          featureBasedPattern.floatPtr(y, x)[0] = 1.0;
        }
      }
    }

    // Create blending masks
    let warpedMaskNorm = new cv.Mat();
    warpedMask.convertTo(warpedMaskNorm, cv.CV_32FC1, 1 / 255.0);

    let sourceMask = new cv.Mat();
    let targetMask = new cv.Mat();
    let maskInv = new cv.Mat();

    // Multiply feature pattern with mask for source face
    cv.multiply(warpedMaskNorm, featureBasedPattern, sourceMask);

    // Create inverted pattern for target features
    let invertedPattern = new cv.Mat();
    cv.subtract(
      new cv.Mat(height, width, cv.CV_32FC1, new cv.Scalar(1)),
      featureBasedPattern,
      invertedPattern
    );

    // Create target mask with inverted pattern
    cv.multiply(warpedMaskNorm, invertedPattern, targetMask);

    // Create inverted mask for background
    cv.threshold(warpedMaskNorm, maskInv, 0, 1, cv.THRESH_BINARY_INV);

    // Convert to 4-channel for blending
    let sourceMask4C = new cv.Mat();
    let targetMask4C = new cv.Mat();
    let maskInv4C = new cv.Mat();
    cv.cvtColor(sourceMask, sourceMask4C, cv.COLOR_GRAY2RGBA);
    cv.cvtColor(targetMask, targetMask4C, cv.COLOR_GRAY2RGBA);
    cv.cvtColor(maskInv, maskInv4C, cv.COLOR_GRAY2RGBA);

    // Convert to floating point for blending
    let foreground = new cv.Mat();
    let background = new cv.Mat();
    warpedFace.convertTo(foreground, cv.CV_32FC4);
    targetFaceRegion.convertTo(background, cv.CV_32FC4);

    // Combine the images with their masks
    let maskedSource = new cv.Mat();
    let maskedTarget = new cv.Mat();
    let maskedBackground = new cv.Mat();
    cv.multiply(foreground, sourceMask4C, maskedSource);
    cv.multiply(background, targetMask4C, maskedTarget);
    cv.multiply(background, maskInv4C, maskedBackground);

    // Combine all components
    let temp = new cv.Mat();
    let blended = new cv.Mat();
    cv.add(maskedSource, maskedTarget, temp);
    cv.add(temp, maskedBackground, blended);

    // Convert back to 8-bit
    blended.convertTo(blended, cv.CV_8UC4);

    // Copy the blended result back to the ROI
    blended.copyTo(roi);

    // Clean up
    roi.delete();
    targetFaceRegion.delete();
    if (resizedFace) resizedFace.delete();
    if (resizedMask) resizedMask.delete();
    graySource.delete();
    grayTarget.delete();
    clahe.delete();
    enhancedSource.delete();
    enhancedTarget.delete();
    sourceEdges.delete();
    targetEdges.delete();
    sourceMorphKernel.delete();
    targetMorphKernel.delete();
    sourceFeatures.delete();
    targetFeatures.delete();
    featureBasedPattern.delete();
    sourceFeaturesMask.delete();
    targetFeaturesMask.delete();
    warpedMaskNorm.delete();
    sourceMask.delete();
    targetMask.delete();
    maskInv.delete();
    invertedPattern.delete();
    sourceMask4C.delete();
    targetMask4C.delete();
    maskInv4C.delete();
    foreground.delete();
    background.delete();
    maskedSource.delete();
    maskedTarget.delete();
    maskedBackground.delete();
    temp.delete();
    blended.delete();

    return result;
  } catch (error) {
    console.error("Error in blendFaces:", error);
    return targetFrame.clone();
  }
}

// Main face swapping function
function swapFaces(sourceImage, targetFrame, targetFaces) {
  try {
    // Validate inputs
    if (!sourceImage || !targetFrame || !targetFaces) {
      console.error("Invalid inputs to swapFaces");
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

      // Apply histogram equalization to improve detection in different lighting
      let equalizedGray = new cv.Mat();
      cv.equalizeHist(sourceGray, equalizedGray);

      // Detect faces in the source image with improved parameters
      faceCascade.detectMultiScale(
        equalizedGray, // Input image
        sourceFaces, // Output vector of detected faces
        1.1, // Scale factor
        5, // Min neighbors (higher value = less detections but higher quality)
        0, // Flags (not used)
        new cv.Size(60, 60), // Min face size
        new cv.Size(0, 0) // Max face size (0,0 means no limit)
      );

      // If no faces detected in source, return original frame
      if (sourceFaces.size() === 0) {
        sourceGray.delete();
        equalizedGray.delete();
        sourceFaces.delete();
        return targetFrame.clone();
      }

      // Extract the first face from source image
      let sourceFaceRect = sourceFaces.get(0);
      let extracted = extractFaceFromUploadedImage(sourceImage, sourceFaceRect);

      // If extraction failed, return original frame
      if (!extracted) {
        sourceGray.delete();
        equalizedGray.delete();
        sourceFaces.delete();
        return targetFrame.clone();
      }

      // Store the extracted face and mask
      sourceFace = extracted.face;
      sourceMask = extracted.mask;

      // Apply feature enhancement to the source face
      let enhancedSource = enhanceFacialFeatures(sourceFace);
      sourceFace.delete();
      sourceFace = enhancedSource;

      // Clean up
      sourceGray.delete();
      equalizedGray.delete();
      sourceFaces.delete();
    }

    // Get the first face from target frame
    let targetFaceRect = targetFaces.get(0);

    // Preprocess the target face region to enhance features
    let targetFaceRegion = targetFrame
      .roi(
        new cv.Rect(
          targetFaceRect.x,
          targetFaceRect.y,
          targetFaceRect.width,
          targetFaceRect.height
        )
      )
      .clone();

    // Enhance the target face features
    let enhancedTarget = enhanceFacialFeatures(targetFaceRegion);
    targetFaceRegion.delete();
    targetFaceRegion = enhancedTarget;

    // Align source face to target face
    let aligned = alignFace(sourceFace, sourceMask, targetFaceRect);

    // If alignment failed, return original frame
    if (!aligned) {
      targetFaceRegion.delete();
      return targetFrame.clone();
    }

    // Blend the aligned face onto the target frame
    let result = blendFaces(
      targetFrame,
      aligned.face,
      aligned.mask,
      targetFaceRect
    );

    // Apply color correction to better match skin tones
    try {
      console.log("Applying color correction for better skin tone matching");
      let colorCorrected = colorCorrectFace(result, targetFaceRegion);
      result.delete();
      result = colorCorrected;
    } catch (error) {
      console.error("Error in color correction:", error);
      // Continue with uncorrected result
    }

    // Clean up
    aligned.face.delete();
    aligned.mask.delete();
    targetFaceRegion.delete();

    return result;
  } catch (error) {
    console.error("Error in swapFaces:", error);
    return targetFrame.clone();
  }
}

// Color correction to match skin tones
function colorCorrectFace(sourceFace, targetFace) {
  try {
    // Validate inputs
    if (!sourceFace || !targetFace) {
      console.error("Invalid inputs to colorCorrectFace");
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

    // Get values from matrices
    let sourceMeanValue = sourceMean.data64F[0];
    let sourceStdDevValue = sourceStdDev.data64F[0];
    let targetMeanValue = targetMean.data64F[0];
    let targetStdDevValue = targetStdDev.data64F[0];

    // Create a normalized version of the L channel
    let sourceL = sourceChannels.get(0);
    let adjustedL = new cv.Mat();
    sourceL.convertTo(adjustedL, cv.CV_32F);

    // Do the color correction calculations manually
    // Step 1: Subtract mean
    for (let i = 0; i < adjustedL.data32F.length; i++) {
      adjustedL.data32F[i] -= sourceMeanValue;
    }

    // Step 2: Scale by std dev ratio
    let stdDevRatio = targetStdDevValue / sourceStdDevValue;
    for (let i = 0; i < adjustedL.data32F.length; i++) {
      adjustedL.data32F[i] *= stdDevRatio;
    }

    // Step 3: Add target mean
    for (let i = 0; i < adjustedL.data32F.length; i++) {
      adjustedL.data32F[i] += targetMeanValue;
    }

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
    console.error("Error in colorCorrectFace:", error);
    return sourceFace.clone();
  }
}

// Function to enhance facial features
function enhanceFacialFeatures(faceImage) {
  try {
    if (!faceImage) {
      console.error("Invalid input to enhanceFacialFeatures");
      return null;
    }

    // Create a grayscale version for feature detection
    let grayFace = new cv.Mat();
    cv.cvtColor(faceImage, grayFace, cv.COLOR_RGBA2GRAY);

    // Apply contrast enhancement
    let equalizedGray = new cv.Mat();
    cv.equalizeHist(grayFace, equalizedGray);

    // Apply bilateral filter to smooth skin while preserving edges (increased parameters)
    let smoothed = new cv.Mat();
    cv.bilateralFilter(faceImage, smoothed, 11, 90, 90);

    // Define a stronger sharpening kernel to enhance edges (facial features)
    let sharpenKernel = new cv.Mat(3, 3, cv.CV_32FC1);
    let sharpenData = sharpenKernel.data32F;
    sharpenData[0] = -0.5;
    sharpenData[1] = -1.0;
    sharpenData[2] = -0.5;
    sharpenData[3] = -1.0;
    sharpenData[4] = 7.0;
    sharpenData[5] = -1.0;
    sharpenData[6] = -0.5;
    sharpenData[7] = -1.0;
    sharpenData[8] = -0.5;

    // Apply sharpening
    let sharpened = new cv.Mat();
    cv.filter2D(
      smoothed,
      sharpened,
      -1,
      sharpenKernel,
      new cv.Point(-1, -1),
      0,
      cv.BORDER_DEFAULT
    );

    // Create a more sensitive edge mask to identify feature regions
    let edges = new cv.Mat();
    cv.Canny(equalizedGray, edges, 30, 120); // Lower thresholds for more detailed edges

    // Apply morphological operations to refine the edges
    let morphKernel = cv.Mat.ones(2, 2, cv.CV_8U);
    let refinedEdges = new cv.Mat();

    // Close small gaps in feature edges (important for continuous feature detection)
    let closedEdges = new cv.Mat();
    cv.morphologyEx(edges, closedEdges, cv.MORPH_CLOSE, morphKernel);

    // Dilate the edges to create wider feature areas (but not too wide)
    cv.dilate(closedEdges, refinedEdges, morphKernel, new cv.Point(-1, -1), 1);

    // Convert edge mask to proper format
    let edgeMask = new cv.Mat();
    cv.cvtColor(refinedEdges, edgeMask, cv.COLOR_GRAY2RGBA);

    // Normalize the mask
    let normMask = new cv.Mat();
    edgeMask.convertTo(normMask, cv.CV_32FC4, 1.0 / 255.0);

    // Create inverse mask
    let invMask = new cv.Mat();
    cv.subtract(
      new cv.Mat(
        faceImage.rows,
        faceImage.cols,
        cv.CV_32FC4,
        new cv.Scalar(1, 1, 1, 1)
      ),
      normMask,
      invMask
    );

    // Apply adaptive histogram equalization for better feature contrast
    let clahe = new cv.CLAHE(3.0, new cv.Size(8, 8));
    let enhancedGray = new cv.Mat();
    clahe.apply(equalizedGray, enhancedGray);

    // Convert enhanced gray to color for blending
    let enhancedColor = new cv.Mat();
    cv.cvtColor(enhancedGray, enhancedColor, cv.COLOR_GRAY2RGBA);

    // Convert images to floating point
    let smoothedFloat = new cv.Mat();
    let sharpenedFloat = new cv.Mat();
    let enhancedFloat = new cv.Mat();

    smoothed.convertTo(smoothedFloat, cv.CV_32FC4);
    sharpened.convertTo(sharpenedFloat, cv.CV_32FC4);
    enhancedColor.convertTo(enhancedFloat, cv.CV_32FC4);

    // Apply feature-aware blending with three components
    let maskedSmooth = new cv.Mat();
    let maskedSharp = new cv.Mat();
    let maskedEnhanced = new cv.Mat();
    let temp = new cv.Mat();
    let result = new cv.Mat();

    // Create a special mask for enhanced details
    let detailMask = new cv.Mat();
    cv.threshold(normMask, detailMask, 0.5, 1.0, cv.THRESH_BINARY);
    let detailMask4C = new cv.Mat();
    cv.cvtColor(detailMask, detailMask4C, cv.COLOR_GRAY2RGBA);

    // Mix the components:
    // 1. Smooth skin areas
    cv.multiply(smoothedFloat, invMask, maskedSmooth);

    // 2. Sharpened features
    cv.multiply(sharpenedFloat, normMask, maskedSharp);

    // 3. Enhanced contrast for important details
    cv.multiply(enhancedFloat, detailMask4C, maskedEnhanced);

    // Combine all components
    cv.add(maskedSmooth, maskedSharp, temp);
    cv.addWeighted(temp, 0.7, maskedEnhanced, 0.3, 0, result);

    // Convert back to 8-bit
    let result8U = new cv.Mat();
    result.convertTo(result8U, cv.CV_8UC4);

    // Clean up
    grayFace.delete();
    equalizedGray.delete();
    smoothed.delete();
    sharpenKernel.delete();
    sharpened.delete();
    edges.delete();
    morphKernel.delete();
    refinedEdges.delete();
    closedEdges.delete();
    edgeMask.delete();
    normMask.delete();
    invMask.delete();
    clahe.delete();
    enhancedGray.delete();
    enhancedColor.delete();
    smoothedFloat.delete();
    sharpenedFloat.delete();
    enhancedFloat.delete();
    maskedSmooth.delete();
    maskedSharp.delete();
    maskedEnhanced.delete();
    temp.delete();
    result.delete();
    detailMask.delete();
    detailMask4C.delete();

    return result8U;
  } catch (error) {
    console.error("Error in enhanceFacialFeatures:", error);
    return faceImage.clone();
  }
}
