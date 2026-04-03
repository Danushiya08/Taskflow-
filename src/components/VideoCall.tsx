import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type VideoCallProps = {
  currentUserId: string;
  targetUserId: string;
};

export default function VideoCall({
  currentUserId,
  targetUserId,
}: VideoCallProps) {
  const myVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Call window ready");

  useEffect(() => {
    let mounted = true;
    let localStream: MediaStream | null = null;

    const startMedia = async () => {
      try {
        setError("");

        if (
          typeof window === "undefined" ||
          !navigator.mediaDevices ||
          !navigator.mediaDevices.getUserMedia
        ) {
          setError("Camera is not supported in this browser.");
          return;
        }

        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        if (!mounted) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }

        localStream = mediaStream;
        setStream(mediaStream);

        if (myVideoRef.current) {
          myVideoRef.current.srcObject = mediaStream;
        }

        setStatus("Camera and microphone ready");
      } catch (err) {
        console.error("Failed to access camera/microphone:", err);
        setError("Camera or microphone access was denied.");
      }
    };

    startMedia();

    return () => {
      mounted = false;

      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const startCall = () => {
    if (!stream) {
      setError("Local camera stream is not ready.");
      return;
    }

    setError("");
    setStatus(`Calling ${targetUserId} from ${currentUserId}`);
    console.log("✅ Call UI ready");
    console.log("Current User:", currentUserId);
    console.log("Target User:", targetUserId);
  };

  const endCall = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }

    if (myVideoRef.current) {
      myVideoRef.current.srcObject = null;
    }

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    setStatus("Call ended");
  };

  return (
    <div className="p-4 rounded-xl border bg-card text-card-foreground space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Video Call</h2>
        <p className="text-sm text-muted-foreground">
          Start a call with your team member
        </p>
      </div>

      {error ? (
        <div className="text-sm text-red-500">{error}</div>
      ) : (
        <div className="text-sm text-muted-foreground">{status}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p className="text-sm mb-2 font-medium">Your Video</p>
          <video
            ref={myVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full rounded-lg bg-black min-h-[220px]"
          />
        </div>

        <div>
          <p className="text-sm mb-2 font-medium">Remote Video</p>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full rounded-lg bg-black min-h-[220px]"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={startCall}>Start Call</Button>

        <Button variant="destructive" onClick={endCall}>
          End Call
        </Button>
      </div>
    </div>
  );
}