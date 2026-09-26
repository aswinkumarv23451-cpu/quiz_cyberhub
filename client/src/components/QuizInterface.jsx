import ParticipantExperience from './participant/ParticipantExperience';

/**
 * QuizInterface (Module 13C Entry Point)
 *
 * Renders the authoritative Round 1 Participant Experience.
 * Preserves the existing component interface for clean backward compatibility.
 */
export default function QuizInterface({ session, onLogout }) {
  return <ParticipantExperience session={session} onLogout={onLogout} />;
}
