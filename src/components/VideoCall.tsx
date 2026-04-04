import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import socket from "@/lib/socket";

type IncomingCallData = {
  from: string;
  signal: RTCSessionDescriptionInit;
};

type VideoCallProps = {
  currentUserId: string;
  targetUserId: string;
  initialIncomingCall?: IncomingCallData | null;
};

export default function VideoCall({
  currentUserId,
  targetUserId,
  initialIncomingCall = null,
}: VideoCallProps) {
  const myVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const [error, setError] = useState("");
  const [status, setStatus] = useState("Call window ready");
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(
    initialIncomingCall
  );
  const [callStarted, setCallStarted] = useState(false);

  useEffect(() => {
    if (initialIncomingCall) {
      setIncomingCall(initialIncomingCall);
      setStatus(`Incoming call from ${initialIncomingCall.from}`);
    }
  }, [initialIncomingCall]);

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
        localStreamRef.current = mediaStream;

        if (myVideoRef.current) {
          myVideoRef.current.srcObject = mediaStream;
        }

        setStatus((prev) =>
          prev.startsWith("Incoming call") ? prev : "Camera and microphone ready"
        );
      } catch (err) {
        console.error("Failed to access camera/microphone:", err);
        setError("Camera or microphone access was denied.");
      }
    };

    startMedia();

    return () => {
      mounted = false;
      cleanupConnection();

      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    const handleCallAccepted = async ({ signal }: { signal: RTCSessionDescriptionInit }) => {
      try {
        if (!peerConnectionRef.current) return;

        await peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(signal)
        );
        setCallStarted(true);
        setStatus("Call connected");
      } catch (err) {
        console.error("Failed to apply remote answer:", err);
        setError("Failed to connect call.");
      }
    };

    const handleIceCandidate = async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
      try {
        if (!peerConnectionRef.current || !candidate) return;

        await peerConnectionRef.current.addIceCandidate(
          new RTCIceCandidate(candidate)
        );
      } catch (err) {
        console.error("Failed to add ICE candidate:", err);
      }
    };

    const handleCallEnded = () => {
      cleanupConnection();
      setIncomingCall(null);
      setCallStarted(false);
      setStatus("Call ended");
    };

    socket.on("call-accepted", handleCallAccepted);
    socket.on("ice-candidate", handleIceCandidate);
    socket.on("call-ended", handleCallEnded);

    return () => {
      socket.off("call-accepted", handleCallAccepted);
      socket.off("ice-candidate", handleIceCandidate);
      socket.off("call-ended", handleCallEnded);
    };
  }, []);

  const cleanupConnection = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  };

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteVideoRef.current && remoteStream) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const sendTo = incomingCall?.from || targetUserId;

        socket.emit("ice-candidate", {
          to: sendTo,
          candidate: event.candidate,
        });
      }
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current as MediaStream);
      });
    }

    peerConnectionRef.current = pc;
    return pc;
  };

  const startCall = async () => {
    if (!localStreamRef.current) {
      setError("Local camera stream is not ready.");
      return;
    }

    try {
      setError("");
      cleanupConnection();

      const pc = createPeerConnection();
      const offer = await pc.createOffer();

      await pc.setLocalDescription(offer);

      socket.emit("call-user", {
        to: targetUserId,
        from: currentUserId,
        signal: offer,
      });

      setStatus(`Calling ${targetUserId}...`);
    } catch (err) {
      console.error("Failed to start call:", err);
      setError("Failed to start call.");
    }
  };

  const answerCall = async () => {
    if (!incomingCall?.signal) {
      setError("No incoming call to answer.");
      return;
    }

    if (!localStreamRef.current) {
      setError("Local camera stream is not ready.");
      return;
    }

    try {
      setError("");
      cleanupConnection();

      const pc = createPeerConnection();

      await pc.setRemoteDescription(
        new RTCSessionDescription(incomingCall.signal)
      );

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("answer-call", {
        to: incomingCall.from,
        signal: answer,
      });

      setCallStarted(true);
      setStatus(`Call connected with ${incomingCall.from}`);
    } catch (err) {
      console.error("Failed to answer call:", err);
      setError("Failed to answer call.");
    }
  };

  const endCall = () => {
    const otherUserId = incomingCall?.from || targetUserId;

    socket.emit("end-call", {
      to: otherUserId,
      from: currentUserId,
    });

    cleanupConnection();
    setIncomingCall(null);
    setCallStarted(false);
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
        {!incomingCall && !callStarted && (
          <Button onClick={startCall}>Start Call</Button>
        )}

        {incomingCall && !callStarted && (
          <Button onClick={answerCall}>Answer Call</Button>
        )}

        <Button variant="destructive" onClick={endCall}>
          End Call
        </Button>
      </div>
    </div>
  );
}