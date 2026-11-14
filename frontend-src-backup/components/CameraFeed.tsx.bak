import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { cartApi } from '../api/cart';
import { DetectionItem } from '../types';
import { Camera, CameraOff, Video, AlertCircle, RefreshCw, HelpCircle } from 'lucide-react';

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
  const [isMockStreaming, setIsMockStreaming] = useState(false);
  const [lastInferenceTime, setLastInferenceTime] = useState<number | null>(null);
  const [detectionCount, setDetectionCount] = useState<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const isInferringRef = useRef<boolean>(false);

  // Stop camera media stream
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }, []);

  // Start live webcam with granular error handling
  const startCamera = async () => {
    setCameraError(null);
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
      let errorMsg = 'Could not access webcam. You can use Simulation mode.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMsg = 'Camera permission was denied. Please allow camera access in your browser or click Simulate Feed.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMsg = 'No camera hardware found on this computer. Click Simulate Feed below to test live recognition.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMsg = 'Camera is already in use by another program. Close other apps or use Simulate Feed.';
      } else if (err.message) {
        errorMsg = err.message;
      }
      setCameraError(errorMsg);
      setIsCameraActive(false);
    }
  };

  // Draw bounding boxes on the overlay canvas
  const drawDetections = (
    detections: DetectionItem[],
    width: number,
    height: number
  ) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    detections.forEach((det) => {
      const { x1, y1, x2, y2 } = det.box;
      const boxWidth = x2 - x1;
      const boxHeight = y2 - y1;

      // Draw box boundary
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#10B981'; // Emerald
      ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
      ctx.strokeRect(x1, y1, boxWidth, boxHeight);
      ctx.fillRect(x1, y1, boxWidth, boxHeight);

      // Label background & text
      const labelText = `${det.product_name || det.class_name} (${Math.round(det.confidence * 100)}%)`;
      ctx.font = 'bold 12px Inter, system-ui, sans-serif';
      const textMetrics = ctx.measureText(labelText);
      const textHeight = 16;
      const textWidth = textMetrics.width;

      ctx.fillStyle = '#10B981';
      ctx.fillRect(x1, Math.max(0, y1 - textHeight - 4), textWidth + 8, textHeight + 4);

      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(labelText, x1 + 4, Math.max(textHeight, y1 - 4));

      // Price badge
      if (det.price_paise) {
        const priceText = `₹${(det.price_paise / 100).toFixed(2)}`;
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(x1, y2 - 20, 60, 20);
        ctx.fillStyle = '#38BDF8';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.fillText(priceText, x1 + 4, y2 - 6);
      }
    });
  };

  // Capture frame and send to backend
  const captureAndDetect = useCallback(async () => {
    if (isInferringRef.current || isProcessingCart) return;

    let base64Image = '';
    const width = 640;
    const height = 480;

    if (isCameraActive && videoRef.current && videoRef.current.readyState === 4) {
      const canvas = canvasRef.current || document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || width;
      canvas.height = videoRef.current.videoHeight || height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      base64Image = canvas.toDataURL('image/jpeg', 0.8);
    } else if (isMockStreaming) {
      // Generate synthetic frame with mock items
      const canvas = canvasRef.current || document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Dark background
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);

      // Draw grid
      ctx.strokeStyle = '#1e293b';
      for (let i = 0; i < width; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, height);
        ctx.stroke();
      }
      for (let i = 0; i < height; i += 40) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(width, i);
        ctx.stroke();
      }

      // Draw placeholder items
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(200, 240, 45, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('Banana', 178, 245);

      ctx.fillStyle = '#0284c7';
      ctx.fillRect(380, 180, 60, 120);
      ctx.fillStyle = '#ffffff';
      ctx.fillText('Bottle', 393, 245);

      base64Image = canvas.toDataURL('image/jpeg', 0.8);
    } else {
      return;
    }

    try {
      isInferringRef.current = true;
      const startTime = performance.now();
      const res = await cartApi.detectBase64(base64Image);
      const elapsed = Math.round(performance.now() - startTime);

      setLastInferenceTime(elapsed);
      setDetectionCount(res.count ?? res.detections?.length ?? 0);
      drawDetections(res.detections, width, height);
      onDetections(res.detections);
    } catch (err) {
      console.error('Detection request failed:', err);
    } finally {
      isInferringRef.current = false;
    }
  }, [isCameraActive, isMockStreaming, isProcessingCart, onDetections]);

  // Periodic frame loop (~3.3 FPS = 300ms)
  useEffect(() => {
    if (!isCameraActive && !isMockStreaming) return;
    const interval = setInterval(() => {
      captureAndDetect();
    }, 300);
    return () => clearInterval(interval);
  }, [isCameraActive, isMockStreaming, captureAndDetect]);

  // Clean up media streams on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col">
      {/* Feed Header */}
      <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <div className="relative flex h-3 w-3">
            {(isCameraActive || isMockStreaming) && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            )}
            <span
              className={`relative inline-flex rounded-full h-3 w-3 ${
                isCameraActive || isMockStreaming ? 'bg-emerald-500' : 'bg-slate-600'
              }`}
            ></span>
          </div>
          <span className="font-semibold text-sm text-white">Live AI Vision Scanner</span>
          {lastInferenceTime !== null && (
            <span className="text-[11px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
              {lastInferenceTime}ms | {detectionCount} items
            </span>
          )}
        </div>

        {/* Camera Controls */}
        <div className="flex items-center space-x-2">
          <Link
            to="/guide#guide-2"
            className="text-slate-400 hover:text-indigo-400 p-1 rounded-lg hover:bg-slate-800 transition-colors"
            title="Camera Scanning Guide"
          >
            <HelpCircle className="w-4 h-4" />
          </Link>

          {isCameraActive ? (
            <button
              onClick={stopCamera}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 flex items-center space-x-1.5 transition-colors"
            >
              <CameraOff className="w-3.5 h-3.5" />
              <span>Stop Camera</span>
            </button>
          ) : (
            <button
              onClick={startCamera}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white flex items-center space-x-1.5 transition-colors shadow-sm"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Start Camera</span>
            </button>
          )}

          <button
            onClick={() => {
              if (isCameraActive) stopCamera();
              setIsMockStreaming(!isMockStreaming);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center space-x-1.5 ${
              isMockStreaming
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>{isMockStreaming ? 'Stop Simulation' : 'Simulate Feed'}</span>
          </button>
        </div>
      </div>

      {/* Video Viewport with Overlay */}
      <div className="relative w-full aspect-[4/3] bg-slate-950 flex items-center justify-center overflow-hidden">
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
          width={640}
          height={480}
          className="absolute inset-0 w-full h-full pointer-events-none z-10"
        />

        {/* Offline / Idle State */}
        {!isCameraActive && !isMockStreaming && (
          <div className="text-center p-6 max-w-sm z-0">
            <div className="w-16 h-16 rounded-2xl bg-slate-800/80 text-slate-400 flex items-center justify-center mx-auto mb-4 border border-slate-700/60 shadow-inner">
              <Camera className="w-8 h-8" />
            </div>
            <h3 className="text-base font-semibold text-slate-200 mb-1">Camera Feed Inactive</h3>
            <p className="text-xs text-slate-400 mb-5 leading-relaxed">
              Start the camera or toggle simulation mode to recognize products placed in front of the scanner.
            </p>
            <div className="flex justify-center gap-2">
              <button
                onClick={startCamera}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium shadow-md shadow-indigo-600/20 transition-colors"
              >
                Turn On Camera
              </button>
              <button
                onClick={() => setIsMockStreaming(true)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium border border-slate-700 transition-colors"
              >
                Simulate Demo
              </button>
            </div>
          </div>
        )}

        {/* Simulation Mode Indicator */}
        {isMockStreaming && (
          <div className="absolute top-3 left-3 z-20 bg-amber-500/90 text-slate-950 text-[11px] font-bold px-2.5 py-1 rounded-md shadow-md uppercase tracking-wider flex items-center space-x-1">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>AI Simulation Mode</span>
          </div>
        )}

        {/* Error Notification with Help Link */}
        {cameraError && (
          <div className="absolute bottom-3 inset-x-3 z-20 bg-rose-950/95 border border-rose-800 text-rose-200 text-xs p-3 rounded-xl flex items-start space-x-2.5 shadow-xl backdrop-blur-md">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-white">Camera Notice</p>
              <p className="text-rose-200 text-[11px] mt-0.5 leading-relaxed">{cameraError}</p>
              <div className="mt-2 flex items-center space-x-3">
                <button
                  onClick={() => {
                    setCameraError(null);
                    setIsMockStreaming(true);
                  }}
                  className="px-2.5 py-1 rounded bg-rose-900/60 hover:bg-rose-900 text-[11px] text-white font-medium transition-colors"
                >
                  Switch to Simulate Feed
                </button>
                <Link
                  to="/guide#guide-3"
                  className="text-[11px] text-rose-300 hover:text-white underline"
                >
                  Troubleshooting Guide →
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Helper footer */}
      <div className="p-3 bg-slate-950 text-slate-400 text-[11px] border-t border-slate-800/80 flex items-center justify-between">
        <span>Framerate: ~3 FPS with temporal smoothing</span>
        <span className="font-mono text-emerald-400">YOLOv8 Real-time Inference</span>
      </div>
    </div>
  );
};
