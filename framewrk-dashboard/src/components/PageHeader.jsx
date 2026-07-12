export default function PageHeader({ eyebrow, title, action }) {
  return (
    <div className="flex items-end justify-between border-b border-line pb-6 mb-8">
      <div>
        {eyebrow && <div className="label-caps mb-2">{eyebrow}</div>}
        <h1 className="font-display text-4xl md:text-5xl font-medium tracking-tight text-ink">
          {title}
        </h1>
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}
