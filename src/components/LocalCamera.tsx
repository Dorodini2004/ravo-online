"use client";

import { useEffect, useRef } from "react";

type LocalCameraProps = {
  cameraError?: string;
  cameraStream: MediaStream | null;
  className?: string;
  compact?: boolean;
  isCameraOn: boolean;
  isMicOn: boolean;
};

export function LocalCamera({
  cameraError = "",
  cameraStream,
  className = "",
  compact = false,
  isCameraOn,
  isMicOn,
}: LocalCameraProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  return (
    <div className={`local-camera ${isCameraOn ? "camera-on" : "camera-off"} ${isMicOn ? "mic-on" : "mic-off"} ${className}`}>
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
          <span className={isMicOn ? "status-on" : "status-off"}>
            Mic {isMicOn ? "On" : "Off"}
          </span>
          <span className={isCameraOn ? "status-on" : "status-off"}>
            Cam {isCameraOn ? "On" : "Off"}
          </span>
        </div>
      </div>

      {cameraError ? <p className="local-camera-error">{cameraError}</p> : null}
    </div>
  );
}
