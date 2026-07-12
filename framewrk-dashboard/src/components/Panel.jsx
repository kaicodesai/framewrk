export default function Panel({ className = '', children }) {
  return (
    <div className={`border border-line bg-panel ${className}`}>
      {children}
    </div>
  )
}
