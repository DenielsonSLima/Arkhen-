import React, { type ReactNode } from 'react';

interface InterSectionCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
}

export const InterSectionCard: React.FC<InterSectionCardProps> = ({ title, description, icon, children }) => (
  <section className="inter-section">
    <header className="inter-section__header">
      <span>{icon}</span>
      <div><h3>{title}</h3><p>{description}</p></div>
    </header>
    <div className="inter-section__body">{children}</div>
  </section>
);

interface InterSwitchProps {
  checked: boolean;
  label: string;
  description: string;
  onChange: (checked: boolean) => void;
}

export const InterSwitch: React.FC<InterSwitchProps> = ({ checked, label, description, onChange }) => (
  <label className="inter-switch-row">
    <span><strong>{label}</strong><small>{description}</small></span>
    <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    <span className="inter-switch" aria-hidden="true" />
  </label>
);
