"use client";

/**
 * Embeds bodhiagent.live as a sandboxed iframe so the user can actually hear
 * and talk to Bodhi. The iframe runs its own audio/WebRTC stack — we don't try
 * to introspect or control it cross-origin.
 *
 * Microphone permission must be granted at the iframe URL; the parent must
 * also permit it via the `allow` attribute below.
 */

type Props = {
  sessionId: string;
};

export function BodhiVoiceFrame({ sessionId }: Props) {
  // Pass our session id through to label Bodhi's session, even though their
  // endpoint may ignore it.
  const src = `https://bodhiagent.live/?userId=client_${sessionId}`;
  return (
    <div className="bodhi-voice">
      <iframe
        title="Bodhi voice agent"
        src={src}
        allow="microphone; autoplay; clipboard-write"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals"
        loading="eager"
      />
    </div>
  );
}
