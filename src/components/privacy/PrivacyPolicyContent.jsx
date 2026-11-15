import React from 'react';

// Renders the policy sections from content/privacyPolicy.js. Used by both the
// public /privacy page and the mandatory consent modal, so the text a user
// accepts is always exactly the text published on the site.

function Block({ item, compact }) {
  if (typeof item === 'string') {
    return <p className="text-slate-600 dark:text-slate-300">{item}</p>;
  }
  if (item.list) {
    return (
      <ul className="space-y-2">
        {item.list.map((li, i) => (
          <li key={i} className="flex gap-2.5 text-slate-600 dark:text-slate-300">
            <span className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600" />
            <span>{li}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (item.sub) {
    return (
      <div className="space-y-2">
        <h3 className={`font-semibold text-slate-900 dark:text-white ${compact ? 'text-sm' : 'text-base'}`}>{item.sub}</h3>
        {item.body.map((b, i) => <Block key={i} item={b} compact={compact} />)}
      </div>
    );
  }
  return null;
}

export default function PrivacyPolicyContent({ policy, compact = false }) {
  return (
    <div className={`space-y-8 ${compact ? 'text-sm leading-6' : 'text-[15px] leading-7'}`}>
      {policy.sections.map((section) => (
        <section key={section.id} id={`privacy-${section.id}`} className="scroll-mt-28 space-y-3">
          <h2 className={`font-bold tracking-tight text-slate-900 dark:text-white ${compact ? 'text-base' : 'text-xl'}`}>{section.title}</h2>
          {section.body.map((item, i) => <Block key={i} item={item} compact={compact} />)}
        </section>
      ))}
    </div>
  );
}
