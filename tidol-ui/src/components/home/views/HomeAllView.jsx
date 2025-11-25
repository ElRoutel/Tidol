import React, { useRef } from 'react';
import SectionBlock from '../SectionBlock';
import MediaCarousel from '../MediaCarousel';
import ListGrid from '../ListGrid';

export default function HomeAllView({ data, onPlay }) {
    const { recentListenings, quickSelection, recommendations, programs, albums, coversRemixes } = data || {};

    const recentRef = useRef(null);
    const recsRef = useRef(null);
    const programsRef = useRef(null);
    const albumsRef = useRef(null);
    const coversRef = useRef(null);

    const handleScroll = (ref, direction) => {
        if (ref.current) {
            direction === 'left' ? ref.current.scrollLeft() : ref.current.scrollRight();
        }
    };

    return (
        <div className="flex flex-col gap-8 pb-20 animate-fade-in">
            {/* Quick Selection (Grid) - No Carousel Controls needed */}
            {quickSelection && quickSelection.length > 0 && (
                <SectionBlock title="Selección rápida" subtitle="Para empezar">
                    <ListGrid items={quickSelection} onPlay={(item, index) => onPlay(item, index, quickSelection)} />
                </SectionBlock>
            )}

            {/* Recent Listenings (Carousel) */}
            {recentListenings && recentListenings.length > 0 && (
                <SectionBlock
                    title="Volver a escuchar"
                    subtitle="Tu historia"
                    showControls
                    onPrev={() => handleScroll(recentRef, 'left')}
                    onNext={() => handleScroll(recentRef, 'right')}
                >
                    <MediaCarousel
                        ref={recentRef}
                        items={recentListenings}
                        onPlay={(item, index) => onPlay(item, index, recentListenings)}
                    />
                </SectionBlock>
            )}

            {/* Recommendations (Carousel) */}
            {recommendations && recommendations.length > 0 && (
                <SectionBlock
                    title="Recomendado para ti"
                    subtitle="Basado en tus gustos"
                    showControls
                    onPrev={() => handleScroll(recsRef, 'left')}
                    onNext={() => handleScroll(recsRef, 'right')}
                >
                    <MediaCarousel
                        ref={recsRef}
                        items={recommendations}
                        onPlay={(item, index) => onPlay(item, index, recommendations)}
                    />
                </SectionBlock>
            )}

            {/* Programs / Podcasts (Carousel) */}
            {programs && programs.length > 0 && (
                <SectionBlock
                    title="Podcasts y Programas"
                    subtitle="Internet Archive"
                    showControls
                    onPrev={() => handleScroll(programsRef, 'left')}
                    onNext={() => handleScroll(programsRef, 'right')}
                >
                    <MediaCarousel
                        ref={programsRef}
                        items={programs}
                        onPlay={(item, index) => onPlay(item, index, programs)}
                    />
                </SectionBlock>
            )}

            {/* Albums (Carousel) */}
            {albums && albums.length > 0 && (
                <SectionBlock
                    title="Álbumes populares"
                    subtitle="Tendencias"
                    showControls
                    onPrev={() => handleScroll(albumsRef, 'left')}
                    onNext={() => handleScroll(albumsRef, 'right')}
                >
                    <MediaCarousel
                        ref={albumsRef}
                        items={albums}
                        type="album"
                    />
                </SectionBlock>
            )}

            {/* Covers & Remixes (Carousel) */}
            {coversRemixes && coversRemixes.length > 0 && (
                <SectionBlock
                    title="Covers y Remixes"
                    subtitle="Descubrimientos"
                    showControls
                    onPrev={() => handleScroll(coversRef, 'left')}
                    onNext={() => handleScroll(coversRef, 'right')}
                >
                    <MediaCarousel
                        ref={coversRef}
                        items={coversRemixes}
                        onPlay={(item, index) => onPlay(item, index, coversRemixes)}
                    />
                </SectionBlock>
            )}
        </div>
    );
}
