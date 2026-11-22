import Image from 'next/image';

/**
 * The home hero's photo collage: Indian students studying.
 *
 * All three are free-licence Unsplash photos (unsplash.com/license) — free to
 * use, commercially too, with no permission needed. Unsplash+ photos are not
 * free and must never be used here. The photographers are credited under the
 * collage even though the licence does not require it.
 *
 * Phones get a three-photo strip under the hero text; from `lg` up the same
 * three photos become an overlapping collage beside it. They are decorative
 * next to the headline, so none is `priority`: the text stays the page's
 * largest paint and the photos never delay it.
 */

type HeroPhoto = {
  id: string;
  alt: string;
  photographer: string;
  username: string;
  /** Wrapper classes: the phone strip first, then the `lg:` collage position. */
  frame: string;
};

const PHOTOS: readonly HeroPhoto[] = [
  {
    id: 'photo-1567168544646-208fa5d408fb',
    alt: 'A student reading a book between library shelves',
    photographer: 'Dollar Gill',
    username: 'dollargill',
    frame: 'lg:left-0 lg:top-0 lg:h-[78%] lg:w-[60%]',
  },
  {
    id: 'photo-1682527896065-c457f0245ea8',
    alt: 'A student writing notes in a book outdoors',
    photographer: 'Shantanu Kumar',
    username: 'theshantanukr',
    frame: 'lg:right-0 lg:top-[6%] lg:h-[42%] lg:w-[44%]',
  },
  {
    id: 'photo-1713963579708-01643e1f43b1',
    alt: 'A student studying at a desk under a lamp at night',
    photographer: 'Swipe',
    username: 'swipe9',
    frame: 'lg:bottom-[4%] lg:right-[3%] lg:h-[44%] lg:w-[50%]',
  },
];

function src(id: string): string {
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&h=1100&q=75`;
}

function credit(path: string): string {
  return `https://unsplash.com/${path}?utm_source=schooltocareer&utm_medium=referral`;
}

export function HeroPhotos() {
  return (
    <figure className="mt-10 lg:mt-0">
      <div className="grid grid-cols-3 gap-3 lg:relative lg:block lg:h-[520px]">
        {PHOTOS.map((photo) => (
          <div
            key={photo.id}
            className={`relative aspect-[3/4] overflow-hidden rounded-2xl shadow-[0_24px_50px_-24px_rgb(22_19_58/0.45)] ring-4 ring-white lg:absolute lg:aspect-auto lg:rounded-[24px] ${photo.frame}`}
          >
            <Image
              src={src(photo.id)}
              alt={photo.alt}
              fill
              sizes="(min-width: 1024px) 270px, 33vw"
              className="object-cover"
            />
          </div>
        ))}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -left-4 bottom-[10%] hidden h-20 w-20 rounded-full bg-hl lg:block"
        />
      </div>
      <figcaption className="mt-3 text-right text-[11px] text-ink-mute">
        Photos:{' '}
        {PHOTOS.map((photo, index) => (
          <span key={photo.id}>
            {index > 0 ? ', ' : ''}
            <a href={credit(`@${photo.username}`)} rel="noopener" className="hover:underline">
              {photo.photographer}
            </a>
          </span>
        ))}{' '}
        on{' '}
        <a href={credit('')} rel="noopener" className="hover:underline">
          Unsplash
        </a>
      </figcaption>
    </figure>
  );
}
