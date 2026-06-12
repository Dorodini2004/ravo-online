"use client";

import { useEffect, useRef } from "react";

type LocalCameraProps = {
  cameraError?: string;
  cameraStream: MediaStream | null;
  className?: string;
  compact?: boolean;
  isCameraOn: boolean;
  isMicOn: boolean;
  onToggleCamera: () => void;
  onToggleMic: () => void;
};

export function LocalCamera({
  cameraError = "",
  cameraStream,
  className = "",
  compact = false,
  isCameraOn,
  isMicOn,
  onToggleCamera,
  onToggleMic,
}: LocalCameraProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  return (
    <div className={`local-camera ${className}`}>
      <div className="local-camera-frame">
        {isCameraOn && cameraStream ? (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="local-camera-video"
          />
        ) : (
          <div className="local-camera-placeholder">
            <div className="local-camera-mask">MASK</div>
            {!compact ? <p>Camera Off</p> : null}
          </div>
        )}

        <div className="local-camera-actions">
          <button type="button" onClick={onToggleMic}>
            Mic {isMicOn ? "On" : "Off"}
          </button>
          <button type="button" onClick={onToggleCamera}>
            Cam {isCameraOn ? "Off" : "On"}
          </button>
        </div>
      </div>

      {cameraError ? <p className="local-camera-error">{cameraError}</p> : null}
    </div>
  );
}
