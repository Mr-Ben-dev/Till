import { OgLogo } from './OgLogo'

export function OgMark({
  className = 'h-[30px] w-[50px]',
  title = '0G',
}: {
  className?: string
  title?: string
}) {
  return <OgLogo className={className} title={title} />
}
