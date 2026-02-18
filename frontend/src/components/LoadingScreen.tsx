export default function LoadingScreen() {
  return (
    <div className="app-container loading-screen">
      <div className="loading-spinner">
        <div className="spinner-ring" />
      </div>
      <p className="loading-text">Connecting to agent server...</p>
    </div>
  );
}
