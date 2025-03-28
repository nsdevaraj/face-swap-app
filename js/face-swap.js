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

    // Get dimensions from the face rectangle (with some margin for better results)
    const margin = 0.2; // 20% margin around the face
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

    // Create a mask for the face (elliptical shape works better than rectangle)
    let mask = new cv.Mat.zeros(h, w, cv.CV_8UC1);

    // Calculate ellipse dimensions and position
    let center = new cv.Point(Math.floor(w / 2), Math.floor(h / 2));
    let axes = new cv.Size(Math.floor(w / 2.2), Math.floor(h / 2.2)); // Slightly smaller than the ROI
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

    // Apply some blur to the mask edges for better blending
    cv.GaussianBlur(mask, mask, new cv.Size(21, 21), 11, 11);

    // Apply the mask to the face to create transparency
    // First convert mask to 4-channel
    let mask4 = new cv.Mat();
    cv.cvtColor(mask, mask4, cv.COLOR_GRAY2RGBA);

    // Scale mask from 0-255 to 0-1 range for alpha blending
    let normMask = new cv.Mat();
    mask4.convertTo(normMask, cv.CV_32FC4, 1.0 / 255.0);

    // Convert face to floating point for multiplication
    let faceFloat = new cv.Mat();
    extractedFace.convertTo(faceFloat, cv.CV_32FC4);

    // Create direct alpha mask
    let alphaMask = new cv.Mat();
    cv.cvtColor(mask, alphaMask, cv.COLOR_GRAY2RGBA);

    // Apply mask to face
    let result = new cv.Mat();
    result = extractedFace.clone();

    // Directly set alpha channel (more reliable approach)
    let srcChannels = new cv.MatVector();
    cv.split(result, srcChannels);

    // Make sure we have 4 channels
    if (srcChannels.size() === 4) {
      // Replace alpha channel directly with mask
      mask.copyTo(srcChannels.get(3));

      // Merge channels back
      cv.merge(srcChannels, result);
      console.log("Applied mask directly to alpha channel");
    } else {
      console.error("Expected 4 channels but got", srcChannels.size());
    }

    // Clean up temporary matrices
    mask4.delete();
    normMask.delete();
    faceFloat.delete();
    alphaMask.delete();
    srcChannels.delete();
    extractedFace.delete();

    console.log("Successfully extracted face with transparency", w, "x", h);

    // Verify alpha channel is properly set
    let debugChannels = new cv.MatVector();
    cv.split(result, debugChannels);
    if (debugChannels.size() === 4) {
      // Check if alpha channel has values (not all 0 or 255)
      let alphaChannel = debugChannels.get(3);
      let minMax = cv.minMaxLoc(alphaChannel);
      console.log("Alpha channel min/max:", minMax.minVal, minMax.maxVal);

      // If all alpha values are the same, we don't have proper transparency
      if (minMax.minVal === minMax.maxVal) {
        console.warn(
          "Alpha channel appears to be uniform - transparency may not work!"
        );
      } else {
        console.log(
          "Alpha channel has varying values - transparency should work"
        );
      }
    }
    debugChannels.delete();

    return {
      face: result,
      mask: mask,
    };
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

    return {
      face: resizedFace,
      mask: resizedMask,
    };
  } catch (error) {
    console.error("Error in alignFace:", error);
    return null;
  }
}

// Blend the warped source face onto the target frame
function blendFaces(targetFrame, warpedFace, warpedMask, targetFaceRect) {
  try {
    // Validate inputs
    if (!targetFrame || !warpedFace || !warpedMask || !targetFaceRect) {
      console.error("Invalid inputs to blendFaces");
      return targetFrame.clone();
    }

    // Create a copy of the target frame
    let result = targetFrame.clone();

    // Declare these variables at the top level of the function
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

    // Extract the ROI using submat instead of direct constructor
    let rect = new cv.Rect(x, y, width, height);
    let roi = result.roi(rect);

    // Ensure warped face and mask dimensions match ROI
    if (
      warpedFace.rows !== height ||
      warpedFace.cols !== width ||
      warpedMask.rows !== height ||
      warpedMask.cols !== width
    ) {
      console.warn(
        "Dimension mismatch in blendFaces, resizing warped face and mask"
      );

      resizedFace = new cv.Mat();
      resizedMask = new cv.Mat();

      let dstSize = new cv.Size(width, height);
      cv.resize(warpedFace, resizedFace, dstSize);
      cv.resize(warpedMask, resizedMask, dstSize);

      // Use the resized versions
      warpedFace = resizedFace;
      warpedMask = resizedMask;
    }

    // Create temporary matrices for blending
    let foreground = new cv.Mat();
    let background = new cv.Mat();

    // Create normalized masks for blending
    let maskNorm = new cv.Mat();
    let maskInv = new cv.Mat();

    // Convert mask to proper format and normalize (0-1 range)
    warpedMask.convertTo(maskNorm, cv.CV_32FC1, 1 / 255.0);

    // Create inverted mask
    cv.threshold(maskNorm, maskInv, 0, 1, cv.THRESH_BINARY_INV);

    // Convert to 4-channel for RGBA multiplication
    let mask4C = new cv.Mat();
    let maskInv4C = new cv.Mat();
    cv.cvtColor(maskNorm, mask4C, cv.COLOR_GRAY2RGBA);
    cv.cvtColor(maskInv, maskInv4C, cv.COLOR_GRAY2RGBA);

    // Convert source and target to floating point for blending
    warpedFace.convertTo(foreground, cv.CV_32FC4);
    roi.convertTo(background, cv.CV_32FC4);

    // Multiply foreground and background by respective masks
    let maskedFg = new cv.Mat();
    let maskedBg = new cv.Mat();

    cv.multiply(foreground, mask4C, maskedFg);
    cv.multiply(background, maskInv4C, maskedBg);

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
    maskNorm.delete();
    maskInv.delete();
    mask4C.delete();
    maskInv4C.delete();
    maskedFg.delete();
    maskedBg.delete();
    blended.delete();

    // Clean up resized versions if created
    if (warpedFace !== resizedFace && resizedFace) resizedFace.delete();
    if (warpedMask !== resizedMask && resizedMask) resizedMask.delete();

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
    let result = blendFaces(
      targetFrame,
      aligned.face,
      aligned.mask,
      targetFaceRect
    );

    // Apply color correction to better match skin tones
    try {
      // Extract target face region for color matching
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

      console.log("Applying color correction for better skin tone matching");
      let colorCorrected = colorCorrectFace(result, targetFaceRegion);
      result.delete();
      result = colorCorrected;

      targetFaceRegion.delete();
    } catch (error) {
      console.error("Error in color correction:", error);
      // Continue with uncorrected result
    }

    // Clean up
    aligned.face.delete();
    aligned.mask.delete();

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
