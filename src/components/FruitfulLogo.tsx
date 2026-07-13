/* The Fruitful "accounts" logo mark, taken verbatim from the Figma asset
   (two leaves + a ringed seed). viewBox is cropped tight to the glyph. */
export default function FruitfulLogo({ size = 17, color = '#232b33' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={(size * 14) / 16} viewBox="8 9 16 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15.4284 22.7555C11.2594 22.1999 8.03732 18.6474 8 14.3332C12.1704 14.8889 15.3925 18.4428 15.4284 22.7555Z" fill={color} />
      <path d="M16.5716 22.7555C20.7406 22.1999 23.9641 18.6474 24 14.3332C19.8296 14.8889 16.6075 18.4428 16.5716 22.7555Z" fill={color} />
      <path
        d="M15.9975 14.9013C14.4244 14.9013 13.1458 13.6213 13.1458 12.0496C13.1458 10.4779 14.4244 9.19792 15.9975 9.19792C17.5705 9.19792 18.8491 10.4779 18.8491 12.0496C18.8491 13.6213 17.5691 14.9013 15.9975 14.9013ZM15.9975 10.3286C15.0492 10.3286 14.2765 11.1 14.2765 12.0496C14.2765 12.9992 15.0478 13.7705 15.9975 13.7705C16.9471 13.7705 17.7184 12.9992 17.7184 12.0496C17.7184 11.1 16.9471 10.3286 15.9975 10.3286Z"
        fill={color}
      />
    </svg>
  );
}
