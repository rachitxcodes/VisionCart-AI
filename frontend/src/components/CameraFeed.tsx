import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { cartApi } from '../api/cart';
import { DetectionItem } from '../types';
import { Camera, CameraOff, AlertCircle, HelpCircle } from 'lucide-react';

interface CameraFeedProps {
  onDetections: (detections: DetectionItem[]) => void;
  isProcessingCart: boolean;
}

export const CameraFeed: React.FC<CameraFeedProps> = ({ onDetections, isProcessingCart }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [detectorError, setDetectorError] = useState<string | null>(null);
  const [detectorMode, setDetectorMode] = useState<string>('real');
  const [isMockStreaming, setIsMockStreaming] = useState(false);
  const [detectionCount, setDetectionCount] = useState<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const isInferringRef = useRef<boolean>(false);

  // Fetch initial detector status from /health
  useEffect(() => {
    api.get('/health')
      .then((res) => {
        const mode = res.data?.detector || res.data?.detector_mode;
        if (mode) setDetectorMode(mode);
      })
      .catch((err) => {
        console.warn('Failed to fetch detector health:', err);
      });
  }, []);

  // Clear detections and overlay immediately
  const clearOverlay = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    setDetectionCount(0);
    onDetections([]);
  }, [onDetections]);

  // Stop camera media stream and clear overlay immediately
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    clearOverlay();
  }, [clearOverlay]);

  // Start live webcam with granular error handling
  const startCamera = async () => {
    setCameraError(null);
    setDetectorError(null);
    clearOverlay();
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Webcam API is not supported in this browser.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
      setIsMockStreaming(false);
    } catch (err: any) {
      console.warn('Camera access failed:', err);
      let errorMsg = 'Could not access webcam. You can use simulation mode.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMsg = 'Camera permission was denied. Please allow camera access in your browser or switch to simulation.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMsg = 'No camera hardware found on this computer. Use simulation to test.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMsg = 'Camera is in use by another program. Close other apps or use simulation.';
      } else if (err.message) {
        errorMsg = err.message;
      }
      setCameraError(errorMsg);
      setIsCameraActive(false);
      clearOverlay();
    }
  };

  // Draw bounding boxes on the overlay canvas scaled to actual displayed video size
  const drawDetections = (
    detections: DetectionItem[],
    frameWidth: number,
    frameHeight: number
  ) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Match internal canvas resolution to actual displayed CSS size
    const displayWidth = canvas.clientWidth || 640;
    const displayHeight = canvas.clientHeight || 480;
    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scaleX = canvas.width / (frameWidth || 640);
    const scaleY = canvas.height / (frameHeight || 480);

    detections.forEach((det) => {
      const x1 = det.box.x1 * scaleX;
      const y1 = det.box.y1 * scaleY;
      const x2 = det.box.x2 * scaleX;
      const y2 = det.box.y2 * scaleY;
      const boxWidth = x2 - x1;
      const boxHeight = y2 - y1;

      // Yellow 2px outline for detection box
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#F5B82E';
      ctx.fillStyle = 'rgba(245, 184, 46, 0.08)';
      ctx.strokeRect(x1, y1, boxWidth, boxHeight);
      ctx.fillRect(x1, y1, boxWidth, boxHeight);

      // Notched price-tag label with item name and price
      const name = det.product_name || det.class_name;
      const priceText = det.price_paise ? `  Rs ${(det.price_paise / 100).toFixed(0)}` : '';
      const labelText = `${name}${priceText}`;

      ctx.font = '600 12px "Figtree Variable", -apple-system, sans-serif';
      const textMetrics = ctx.measureText(labelText);
      const tagHeight = 22;
      const tagWidth = textMetrics.width + 16;
      const tagX = x1;
      const tagY = Math.max(tagHeight + 2, y1);

      // Draw tag-yellow price tag with a notched left corner
      ctx.fillStyle = '#F5B82E';
      ctx.beginPath();
      ctx.moveTo(tagX, tagY - tagHeight);
      ctx.lineTo(tagX + tagWidth, tagY - tagHeight);
      ctx.lineTo(tagX + tagWidth, tagY - 4);
      ctx.lineTo(tagX + 6, tagY - 4);
      ctx.lineTo(tagX, tagY - 10);
      ctx.closePath();
      ctx.fill();

      // Dark ink text on price tag
      ctx.fillStyle = '#1C2321';
      ctx.fillText(labelText, tagX + 6, tagY - 8);
    });
  };

  // Capture frame and send to backend
  const captureAndDetect = useCallback(async () => {
    if (isInferringRef.current || isProcessingCart) return;

    let base64Image = '';
    let inputWidth = 640;
    let inputHeight = 480;

    if (isCameraActive && videoRef.current && videoRef.current.readyState === 4) {
      const canvas = canvasRef.current || document.createElement('canvas');
      inputWidth = videoRef.current.videoWidth || 640;
      inputHeight = videoRef.current.videoHeight || 480;
      canvas.width = inputWidth;
      canvas.height = inputHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      base64Image = canvas.toDataURL('image/jpeg', 0.8);
    } else if (isMockStreaming && !isCameraActive) {
      // Synthetic demo frame only when real camera is off
      const canvas = canvasRef.current || document.createElement('canvas');
      canvas.width = inputWidth;
      canvas.height = inputHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#1C2321';
      ctx.fillRect(0, 0, inputWidth, inputHeight);

      // Draw quiet grid lines
      ctx.strokeStyle = '#2B3431';
      for (let i = 0; i < inputWidth; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, inputHeight);
        ctx.stroke();
      }
      for (let i = 0; i < inputHeight; i += 40) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(inputWidth, i);
        ctx.stroke();
      }

      // Placeholder item shapes
      ctx.fillStyle = '#F5B82E';
      ctx.beginPath();
      ctx.arc(200, 240, 45, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1C2321';
      ctx.font = '600 12px sans-serif';
      ctx.fillText('Banana', 178, 245);

      ctx.fillStyle = '#146C54';
      ctx.fillRect(380, 180, 60, 120);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('Bottle', 393, 245);

      base64Image = canvas.toDataURL('image/jpeg', 0.8);
    } else {
      return;
    }

    try {
      isInferringRef.current = true;
      const res = await cartApi.detectBase64(base64Image);

      // If user stopped feed while request was in flight, discard results
      if (!isCameraActive && !isMockStreaming) {
        clearOverlay();
        return;
      }

      setDetectorError(null);
      const activeMode = (res as any).detector_mode;
      if (activeMode) {
        setDetectorMode(activeMode);
      }
      setDetectionCount(res.count ?? res.detections?.length ?? 0);
      drawDetections(res.detections, inputWidth, inputHeight);
      onDetections(res.detections);
    } catch (err: any) {
      console.error('Detection request failed:', err);
      const errMsg = err.response?.data?.detail || err.message || 'Detector communication error';
      setDetectorError(errMsg);
      clearOverlay();
    } finally {
      isInferringRef.current = false;
    }
  }, [isCameraActive, isMockStreaming, isProcessingCart, onDetections, clearOverlay]);

  // Frame sampling loop (~3.3 FPS = 300ms)
  useEffect(() => {
    if (!isCameraActive && !isMockStreaming) return;
    const interval = setInterval(() => {
      captureAndDetect();
    }, 300);
    return () => clearInterval(interval);
  }, [isCameraActive, isMockStreaming, captureAndDetect]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      clearOverlay();
    };
  }, [stopCamera, clearOverlay]);

  // Quiet readable status message
  const statusText = isCameraActive
    ? `Camera on, ${detectionCount} ${detectionCount === 1 ? 'item' : 'items'} seen`
    : isMockStreaming
    ? `Simulation on, ${detectionCount} ${detectionCount === 1 ? 'item' : 'items'} seen`
    : 'Camera off';

  return (
    <div className="bg-surface border border-counter-grey rounded-panel overflow-hidden flex flex-col shadow-sm">
      {/* Feed Header */}
      <div className="px-4 py-3 bg-surface border-b border-counter-grey flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2.5">
          <span
            className={`w-2 h-2 rounded-full ${
              isCameraActive || isMockStreaming ? 'bg-primary animate-pulse' : 'bg-counter-grey'
            }`}
          />
          <span className="text-xs font-medium text-ink">{statusText}</span>

          {/* Calm plain-language mode badges */}
          {detectorError ? (
            <span className="text-[11px] font-medium text-white bg-signal px-2 py-0.5 rounded-control">
              Detector error
            </span>
          ) : isMockStreaming || detectorMode === 'mock' ? (
            <span className="text-[11px] font-medium text-ink bg-tag-tint border border-tag-yellow/50 px-2 py-0.5 rounded-control">
              Demo simulation
            </span>
          ) : (
            <span className="text-[11px] font-medium text-primary bg-primary-tint border border-primary/20 px-2 py-0.5 rounded-control">
              Live recognition
            </span>
          )}
        </div>

        {/* Camera Controls */}
        <div className="flex items-center space-x-2">
          <Link
            to="/guide#guide-2"
            className="text-ink-muted hover:text-ink p-1.5 rounded-control hover:bg-counter-light transition-colors"
            title="Camera guide"
          >
            <HelpCircle className="w-4 h-4" />
          </Link>

          {isCameraActive ? (
            <button
              onClick={stopCamera}
              className="px-3 py-1.5 rounded-control text-xs font-semibold bg-signal hover:bg-red-700 text-white flex items-center space-x-1.5 transition-colors shadow-sm"
            >
              <CameraOff className="w-3.5 h-3.5" />
              <span>Stop camera</span>
            </button>
          ) : (
            <button
              onClick={startCamera}
              className="px-3.5 py-1.5 rounded-control text-xs font-semibold bg-primary hover:bg-primary-hover text-white flex items-center space-x-1.5 transition-colors shadow-sm"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Start camera</span>
            </button>
          )}

          <button
            onClick={() => {
              if (isCameraActive) stopCamera();
              clearOverlay();
              setIsMockStreaming(!isMockStreaming);
            }}
            className="text-xs text-ink-muted hover:text-ink font-medium px-2 py-1.5 underline decoration-counter-grey hover:decoration-ink transition-colors"
          >
            <span>{isMockStreaming ? 'Stop simulation' : 'Simulate feed'}</span>
          </button>
        </div>
      </div>

      {/* Video Viewport: kept dark because it displays raw camera video */}
      <div className="relative w-full aspect-[4/3] bg-[#141A18] flex items-center justify-center overflow-hidden">
        {/* HTML5 Video element */}
        <video
          ref={videoRef}
          playsInline
          muted
          className={`absolute inset-0 w-full h-full object-cover ${
            isCameraActive ? 'block' : 'hidden'
          }`}
        />

        {/* Hidden processing canvas */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Transparent Bounding Box Overlay Canvas */}
        <canvas
          ref={overlayCanvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none z-10"
        />

        {/* Offline / Idle State */}
        {!isCameraActive && !isMockStreaming && (
          <div className="text-center p-6 max-w-sm z-0">
            <div className="w-12 h-12 rounded-control bg-surface/10 text-white/70 flex items-center justify-center mx-auto mb-3 border border-white/10">
              <Camera className="w-6 h-6" />
            </div>
            <h2 className="text-sm font-heading font-semibold text-white mb-1">Camera is off</h2>
            <p className="text-xs text-white/70 mb-4 leading-relaxed">
              Start the camera or toggle simulation to identify items on the shop counter.
            </p>
            <div className="flex justify-center gap-2">
              <button
                onClick={startCamera}
                className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-control text-xs font-semibold shadow-sm transition-colors"
              >
                Start camera
              </button>
              <button
                onClick={() => {
                  clearOverlay();
                  setIsMockStreaming(true);
                }}
                className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-control text-xs font-medium border border-white/15 transition-colors"
              >
                Simulate feed
              </button>
            </div>
          </div>
        )}

        {/* Detector Error Banner */}
        {detectorError && (
          <div className="absolute top-3 inset-x-3 z-30 bg-signal text-white text-xs p-3 rounded-control flex items-start space-x-2.5 shadow-lg">
            <AlertCircle className="w-4 h-4 text-white flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-white">Detector error</p>
              <p className="text-white/90 text-[11px] mt-0.5 leading-relaxed font-mono">{detectorError}</p>
            </div>
          </div>
        )}

        {/* Camera Permission / Hardware Notice */}
        {cameraError && (
          <div className="absolute bottom-3 inset-x-3 z-20 bg-signal text-white text-xs p-3 rounded-control flex items-start space-x-2.5 shadow-lg">
            <AlertCircle className="w-4 h-4 text-white flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-white">Camera notice</p>
              <p className="text-white/90 text-[11px] mt-0.5 leading-relaxed">{cameraError}</p>
              <div className="mt-2 flex items-center space-x-3">
                <button
                  onClick={() => {
                    setCameraError(null);
                    clearOverlay();
                    setIsMockStreaming(true);
                  }}
                  className="px-2.5 py-1 rounded-control bg-white/20 hover:bg-white/30 text-[11px] text-white font-medium transition-colors"
                >
                  Switch to simulation
                </button>
                <Link
                  to="/guide#guide-3"
                  className="text-[11px] text-white/90 hover:text-white underline"
                >
                  Troubleshooting guide
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quiet, quiet footer */}
      <div className="px-4 py-2 bg-surface text-ink-muted text-xs border-t border-counter-grey flex items-center justify-between">
        <span>Vision recognition ready</span>
        <span>Sampling ~3 frames per second</span>
      </div>
    </div>
  );
};
