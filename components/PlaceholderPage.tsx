import React from 'react';
import { Icons } from './icons';

interface PlaceholderPageProps {
  title: string;
}

const PlaceholderPage: React.FC<PlaceholderPageProps> = ({ title }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <Icons.FileCog className="w-24 h-24 text-gray-300 mb-4" />
      <h1 className="text-3xl font-bold text-brand-text-primary mb-2">{title}</h1>
      <p className="text-brand-text-secondary">This page is under construction.</p>
    </div>
  );
};

export default PlaceholderPage;