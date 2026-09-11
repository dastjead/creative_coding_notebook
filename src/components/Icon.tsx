interface IconProps {
  name: 'archive' | 'plus' | 'play' | 'stop' | 'reset' | 'camera' | 'search' | 'settings' | 'star' | 'copy' | 'download' | 'upload' | 'trash' | 'code';
  size?: number;
}

const paths: Record<IconProps['name'], React.ReactNode> = {
  archive: <><rect x="3" y="5" width="18" height="16" rx="1"/><path d="M8 3h8l2 2H6l2-2ZM9 10h6"/></>,
  plus: <><path d="M12 5v14M5 12h14"/></>,
  play: <path d="m8 5 11 7-11 7V5Z"/>,
  stop: <rect x="6" y="6" width="12" height="12" rx="1"/>,
  reset: <><path d="M4 12a8 8 0 1 0 2.3-5.7L4 8"/><path d="M4 3v5h5"/></>,
  camera: <><path d="M4 8h3l2-3h6l2 3h3v11H4V8Z"/><circle cx="12" cy="13" r="3"/></>,
  search: <><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1A8 8 0 0 0 15 6l-.4-2.6h-4L10 6a8 8 0 0 0-1.5 1L6 6.1 4 9.5 6 11a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.5-1A8 8 0 0 0 10 18l.5 2.6h4L15 18a8 8 0 0 0 1.5-1l2.4.9 2-3.4-2-1.5a7 7 0 0 0 .1-1Z"/></>,
  star: <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/>,
  copy: <><rect x="8" y="8" width="11" height="11" rx="1"/><path d="M16 8V5H5v11h3"/></>,
  download: <><path d="M12 3v12m-5-5 5 5 5-5"/><path d="M5 20h14"/></>,
  upload: <><path d="M12 16V4m-5 5 5-5 5 5"/><path d="M5 20h14"/></>,
  trash: <><path d="M5 7h14M9 7V4h6v3m2 0-1 13H8L7 7"/><path d="M10 11v5m4-5v5"/></>,
  code: <><path d="m9 6-6 6 6 6m6-12 6 6-6 6"/><path d="m14 4-4 16"/></>,
};

export function Icon({ name, size = 20 }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}
