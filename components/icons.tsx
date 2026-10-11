import type { ReactNode } from "react";

function Icon({ children, size = 20, filled = false }: { children: ReactNode; size?: number; filled?: boolean }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill={filled ? "currentColor" : "none"}
            stroke={filled ? "none" : "currentColor"}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            {children}
        </svg>
    );
}

type Props = { size?: number };

export const PlayIcon = ({ size }: Props) => (
    <Icon size={size} filled>
        <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" />
    </Icon>
);

export const StopIcon = ({ size }: Props) => (
    <Icon size={size} filled>
        <rect x="6" y="6" width="12" height="12" rx="2" />
    </Icon>
);

export const SpeakerIcon = ({ size }: Props) => (
    <Icon size={size}>
        <path d="M11 5 6 9H3v6h3l5 4V5z" />
        <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
    </Icon>
);

export const MicIcon = ({ size }: Props) => (
    <Icon size={size}>
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </Icon>
);

export const SunriseIcon = ({ size }: Props) => (
    <Icon size={size}>
        <path d="M3 18h18M6 18a6 6 0 0 1 12 0M12 5v4M5 11l2 2M19 11l-2 2" />
    </Icon>
);

export const SunIcon = ({ size }: Props) => (
    <Icon size={size}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </Icon>
);

export const MoonIcon = ({ size }: Props) => (
    <Icon size={size}>
        <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
    </Icon>
);

export const CalendarIcon = ({ size }: Props) => (
    <Icon size={size}>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
    </Icon>
);

export const AlertIcon = ({ size }: Props) => (
    <Icon size={size}>
        <path d="M12 3 2 20h20L12 3zM12 10v4M12 17.5v.01" />
    </Icon>
);

export const UploadIcon = ({ size }: Props) => (
    <Icon size={size}>
        <path d="M12 16V4M7 9l5-5 5 5M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" />
    </Icon>
);

export const LocateIcon = ({ size }: Props) => (
    <Icon size={size}>
        <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8l-5-5z" />
        <path d="M14 3v5h5M9 13h6M9 17h4" />
    </Icon>
);

export const PhoneIcon = ({ size }: Props) => (
    <Icon size={size}>
        <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z" />
    </Icon>
);
