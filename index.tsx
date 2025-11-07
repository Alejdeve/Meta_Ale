import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI } from '@google/genai';

const App = () => {
    const [title, setTitle] = useState('');
    const [style, setStyle] = useState('Realista');
    const [addText, setAddText] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [images, setImages] = useState<{ src: string; format: string; ratio: string; }[]>([]);

    const styles = [
        'Realista', 'Cinematográfico', 'Minimalista', 'Tipográfico', 'Ilustrativo', 'Abstracto', 'Vintage', 'Futurista'
    ];
    
    const formats = [
        { name: 'Reel/Historia', ratio: '9:16' },
        { name: 'Post Cuadrado', ratio: '1:1' },
        { name: 'Anuncio Horizontal', ratio: '16:9' }
    ];

    const handleGenerate = async () => {
        if (!title.trim()) {
            setError('Por favor, introduce un título para el anuncio.');
            return;
        }
        
        setLoading(true);
        setError(null);
        setImages([]);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

            let basePrompt = `Crea una imagen de alta calidad para un anuncio de Meta (Facebook/Instagram). El anuncio es para un producto o servicio llamado "${title}". El estilo visual debe ser ${style}.`;
            if (addText) {
                basePrompt += ` La imagen debe incluir el texto "${title}" de forma grande, clara y legible, perfectamente integrado en el diseño.`;
            } else {
                basePrompt += ` La imagen no debe contener texto.`;
            }

            const generationPromises = formats.map(format => 
                ai.models.generateImages({
                    model: 'imagen-4.0-generate-001',
                    prompt: `${basePrompt} El formato de la imagen debe ser para ${format.name}.`,
                    config: {
                        numberOfImages: 1,
                        aspectRatio: format.ratio,
                        outputMimeType: 'image/jpeg',
                    },
                })
            );

            const results = await Promise.all(generationPromises);
            
            const generatedImages = results.map((res, index) => {
                if (!res.generatedImages || res.generatedImages.length === 0) {
                    throw new Error(`No se pudo generar la imagen para el formato ${formats[index].name}.`);
                }
                const base64ImageBytes = res.generatedImages[0].image.imageBytes;
                const src = `data:image/jpeg;base64,${base64ImageBytes}`;
                return {
                    src,
                    format: formats[index].name,
                    ratio: formats[index].ratio,
                };
            });

            setImages(generatedImages);

        } catch (err: any) {
            console.error(err);
            setError(`Hubo un error al generar las imágenes: ${err.message}. Por favor, inténtalo de nuevo.`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container">
            <h1>Generador de imágenes para meta ads</h1>
            <div className="controls">
                <div className="form-group">
                    <label htmlFor="title">Título del anuncio</label>
                    <input
                        type="text"
                        id="title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Ej: Zapatillas EcoFly"
                        disabled={loading}
                        aria-required="true"
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="style">Estilo Visual</label>
                    <select id="style" value={style} onChange={(e) => setStyle(e.target.value)} disabled={loading}>
                        {styles.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                <div className="checkbox-group" onClick={() => !loading && setAddText(!addText)}>
                     <input 
                        type="checkbox" 
                        id="addText" 
                        checked={addText} 
                        onChange={(e) => setAddText(e.target.checked)} 
                        disabled={loading}
                        aria-labelledby="addTextLabel"
                    />
                    <label htmlFor="addText" id="addTextLabel">Añadir texto grande</label>
                </div>
                <button onClick={handleGenerate} disabled={loading || !title.trim()}>
                    {loading ? 'Generando...' : 'Generar Imágenes'}
                </button>
            </div>

            {error && <div className="error" role="alert">{error}</div>}

            {loading && (
                 <div className="results" aria-live="polite">
                    {formats.map(format => (
                        <div key={format.name} className="image-card">
                             <h3>{format.name} ({format.ratio})</h3>
                             <div className="image-placeholder" style={{ aspectRatio: format.ratio.replace(':', ' / ') }}>
                                <span>Cargando...</span>
                             </div>
                        </div>
                    ))}
                 </div>
            )}

            {images.length > 0 && (
                <div className="results">
                    {images.map((image, index) => (
                        <div key={index} className="image-card">
                            <h3>{image.format} ({image.ratio})</h3>
                            <img src={image.src} alt={`Anuncio para ${title} en formato ${image.format}`} style={{ aspectRatio: image.ratio.replace(':', ' / ') }} />
                            <a 
                                href={image.src} 
                                download={`anuncio_${title.replace(/\s+/g, '_')}_${image.format.replace(/[\s/]+/g, '_')}.jpeg`}
                                className="download-btn"
                            >
                                Descargar
                            </a>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<React.StrictMode><App /></React.StrictMode>);
