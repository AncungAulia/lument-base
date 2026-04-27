export default function UsdcIcon({
  size = 16,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block shrink-0 ${className}`}
    >
      <circle cx="12" cy="12" r="12" fill="#2775CA" />
      <path
        d="M14.25 13.5c0-1.245-.748-1.673-2.25-1.845V9.75c.637.12 1.035.487 1.095 1.125h1.41C14.43 9.645 13.5 8.775 12 8.625V7.5h-.75v1.125c-1.425.15-2.25.9-2.25 1.95 0 1.2.682 1.657 2.25 1.845v2.01c-.818-.135-1.23-.578-1.29-1.305H8.55c.075 1.41 1.005 2.205 2.7 2.355V16.5H12v-1.005c1.425-.15 2.25-.915 2.25-2.025v.03Zm-3-.262c-.908-.18-1.125-.457-1.125-.938 0-.457.27-.787 1.125-.93v1.868Zm.75 2.122v-1.89c.803.18 1.125.45 1.125.952 0 .51-.338.81-1.125.938Z"
        fill="white"
      />
    </svg>
  );
}
