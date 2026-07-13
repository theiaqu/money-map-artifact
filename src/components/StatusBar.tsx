export default function StatusBar() {
  return (
    <div className="status-bar">
      <div className="time">9:41</div>
      <div className="status-icons">
        {/* cellular */}
        <svg width="18" height="12" viewBox="0 0 18 12" fill="#000" xmlns="http://www.w3.org/2000/svg">
          <rect x="0" y="8" width="3" height="4" rx="1" />
          <rect x="5" y="5.5" width="3" height="6.5" rx="1" />
          <rect x="10" y="3" width="3" height="9" rx="1" />
          <rect x="15" y="0.5" width="3" height="11.5" rx="1" />
        </svg>
        {/* wifi */}
        <svg width="17" height="12" viewBox="0 0 17 12" fill="#000" xmlns="http://www.w3.org/2000/svg">
          <path d="M8.5 2C11.4 2 14.05 3.13 16 4.98L14.6 6.42C13.02 4.93 10.87 4.01 8.5 4.01S3.98 4.93 2.4 6.42L1 4.98C2.95 3.13 5.6 2 8.5 2Z" />
          <path d="M8.5 5.6C10.24 5.6 11.83 6.28 13 7.4L11.58 8.85C10.78 8.08 9.7 7.6 8.5 7.6S6.22 8.08 5.42 8.85L4 7.4C5.17 6.28 6.76 5.6 8.5 5.6Z" />
          <path d="M8.5 9.1C9.16 9.1 9.76 9.37 10.2 9.8L8.5 11.5L6.8 9.8C7.24 9.37 7.84 9.1 8.5 9.1Z" />
        </svg>
        {/* battery */}
        <svg width="27" height="13" viewBox="0 0 27 13" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="0.5" y="0.5" width="23" height="12" rx="3.5" stroke="#000" strokeOpacity="0.35" />
          <rect x="2" y="2" width="20" height="9" rx="2" fill="#000" />
          <path d="M25 4.2V8.8C25.9 8.42 26.5 7.53 26.5 6.5C26.5 5.47 25.9 4.58 25 4.2Z" fill="#000" fillOpacity="0.4" />
        </svg>
      </div>
    </div>
  );
}
