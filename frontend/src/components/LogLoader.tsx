import { useState, useEffect } from "react";

const FRIENDLY_LOGS = [
  "Working on it...",
  "Checking things on LinkedIn...",
  "Reading the latest updates...",
  "Preparing a response...",
  "Almost there...",
];

export default function LogLoader() {
  const [currentLine, setCurrentLine] = useState(FRIENDLY_LOGS[0]);

  useEffect(() => {
    const countRef = { current: 1 };

    const interval = setInterval(() => {
      const nextIndex = countRef.current;
      countRef.current += 1;

      setCurrentLine(FRIENDLY_LOGS[nextIndex % FRIENDLY_LOGS.length]);
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="friendly-loader">
      <div className="friendly-spinner">
        <div className="bounce1"></div>
        <div className="bounce2"></div>
        <div className="bounce3"></div>
      </div>
      <p className="friendly-text">{currentLine}</p>
    </div>
  );
}
