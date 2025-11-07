import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Modality } from '@google/genai';

// Interfaces for the structured routine data
interface Exercise {
    name: string;
    sets: string;
    reps: string;
    rpe: string;
    rest: string;
    description: string;
    imageQuery: string;
    imageUrl?: string;
}

interface DayPlan {
    day: string;
    exercises: Exercise[];
}

interface WeekPlan {
    week: number;
    plan: DayPlan[];
}

interface Nutrition {
    protein: string;
    hydration: string;
    sleep: string;
}

interface RoutinePlan {
    title: string;
    introduction: string;
    weeklyPlan: WeekPlan[];
    nutritionAdvice: Nutrition;
    finalMessage: string;
}

const App = () => {
    // State for form inputs
    const [formData, setFormData] = useState({
        genero: 'Hombre',
        edad: '',
        altura: '',
        alturaUnidad: 'cm',
        peso: '',
        masaMuscular: '',
        grasaCorporal: '',
        meta: 'Ganar músculo',
        tiempo: 'Máx. 3 días/semana',
        lugar: 'Gym',
        material: 'Cuento con material',
        screening: ''
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [routine, setRoutine] = useState<RoutinePlan | null>(null);

    const isGym = formData.lugar === 'Gym';

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    
    const handleRadioChange = (name: string, value: string) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const isFormValid = useMemo(() => {
        return formData.edad && formData.altura && formData.peso && formData.masaMuscular && formData.grasaCorporal;
    }, [formData]);

    const generateExerciseImages = async (routineData: RoutinePlan) => {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        
        for (const week of routineData.weeklyPlan) {
            for (const day of week.plan) {
                for (const exercise of day.exercises) {
                    try {
                        const response = await ai.models.generateContent({
                            model: 'gemini-2.5-flash-image',
                            contents: {
                                parts: [{ text: `A clear, high-quality, realistic photo of ${exercise.imageQuery} in a modern gym setting.` }],
                            },
                            config: {
                                responseModalities: [Modality.IMAGE],
                            },
                        });
                        
                        const part = response.candidates?.[0]?.content?.parts?.[0];
                        if (part?.inlineData) {
                            const base64ImageBytes = part.inlineData.data;
                            const imageUrl = `data:image/png;base64,${base64ImageBytes}`;
                            
                            setRoutine(currentRoutine => {
                                if (!currentRoutine) return null;
                                const updatedWeeklyPlan = currentRoutine.weeklyPlan.map(w => 
                                    w.week !== week.week ? w : {
                                        ...w,
                                        plan: w.plan.map(d => 
                                            d.day !== day.day ? d : {
                                                ...d,
                                                exercises: d.exercises.map(e => 
                                                    e.name !== exercise.name ? e : { ...e, imageUrl }
                                                )
                                            }
                                        )
                                    }
                                );
                                return { ...currentRoutine, weeklyPlan: updatedWeeklyPlan };
                            });
                        }
                    } catch (err) {
                        console.error(`Failed to generate image for ${exercise.name}:`, err);
                    }
                }
            }
        }
    };

    const handleGenerateRutina = async () => {
        if (!isFormValid) {
            setError('Por favor, completa todos los campos numéricos requeridos.');
            return;
        }

        setLoading(true);
        setError(null);
        setRoutine(null);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
            
            const prompt = `
                Actúa como un coach experto en actividad física, nutrición y entrenamiento personal de clase mundial.
                Basado en los siguientes datos del usuario, genera una rutina de entrenamiento completa y detallada para las próximas 4 semanas (Mes 1).

                **Datos del Usuario:**
                - Género: ${formData.genero}
                - Edad: ${formData.edad} años
                - Altura: ${formData.altura} ${formData.alturaUnidad}
                - Peso: ${formData.peso} kg
                - Porcentaje de Masa Muscular: ${formData.masaMuscular}%
                - Porcentaje de Grasa Corporal: ${formData.grasaCorporal}%
                - Meta Principal: ${formData.meta}
                - Disponibilidad de Tiempo: ${formData.tiempo}
                - Lugar de Entrenamiento: ${formData.lugar}
                - Material Disponible: ${isGym ? 'Acceso completo a equipamiento de gimnasio' : formData.material}
                - Screening (lesiones, patologías, etc.): ${formData.screening || 'Ninguna reportada'}

                **Instrucciones para la Generación del Plan:**

                Tu única y exclusiva salida debe ser un objeto JSON válido. No incluyas texto antes o después del JSON, ni uses bloques de código Markdown.

                El JSON debe seguir esta estructura exacta:
                {
                  "title": "Tu Plan de 4 Semanas para ${formData.meta}",
                  "introduction": "Un párrafo introductorio motivador sobre el plan personalizado para este primer mes.",
                  "weeklyPlan": [
                    {
                      "week": 1,
                      "plan": [
                        {
                          "day": "Día 1: Nombre del Enfoque (ej: Tren Superior)",
                          "exercises": [
                            {
                              "name": "Nombre del Ejercicio",
                              "sets": "4",
                              "reps": "8-10",
                              "rpe": "7-8",
                              "rest": "90 segundos",
                              "description": "Una breve descripción (2-3 frases) de cómo realizar el ejercicio correctamente, enfocándose en la técnica.",
                              "imageQuery": "frase corta en inglés para buscar una foto del ejercicio (ej: man doing barbell bench press)"
                            }
                          ]
                        }
                      ]
                    }
                  ],
                  "nutritionAdvice": {
                    "protein": "Recomendación general sobre la importancia de la ingesta de proteínas para la meta del usuario.",
                    "hydration": "Recomendación general sobre la importancia de la hidratación.",
                    "sleep": "Recomendación general sobre la importancia del descanso y el sueño."
                  },
                  "finalMessage": "Un mensaje final motivador que anime al usuario a empezar y a volver en 4 semanas para generar el siguiente mes de tu plan basado en tu progreso."
                }

                **Directrices Clave para el Contenido del JSON:**
                1.  **imageQuery**: Para cada ejercicio, proporciona una frase corta y descriptiva en inglés, ideal para una API de búsqueda de imágenes (ej: "woman doing dumbbell lunges", "man performing pull-ups"). Debe ser específica.
                2.  **Progresión**: Asegúrate de que haya una progresión clara a lo largo de estas 4 semanas en el array 'weeklyPlan'.
                3.  **Adaptación**: Adapta los ejercicios al lugar y material indicado. Si es 'casa' y 'sin material', usa ejercicios de peso corporal.
                4.  **Completitud**: Genera el plan completo para estas 4 semanas. Sé detallado y realista.
            `;
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-pro',
                contents: prompt,
            });
            
            let jsonString = response.text;
            if (jsonString.startsWith('```json')) {
                jsonString = jsonString.slice(7, -3).trim();
            } else if (jsonString.startsWith('```')) {
                 jsonString = jsonString.slice(3, -3).trim();
            }

            try {
                const parsedRoutine: RoutinePlan = JSON.parse(jsonString);
                setRoutine(parsedRoutine);
                generateExerciseImages(parsedRoutine); // Generate images after setting the routine text
            } catch (jsonError) {
                console.error("Failed to parse JSON response:", jsonString, jsonError);
                setError("La IA devolvió una respuesta en un formato inesperado. Por favor, inténtalo de nuevo.");
            }

        } catch (err: any) {
            console.error(err);
            setError(`Hubo un error al generar la rutina: ${err.message}. Por favor, inténtalo de nuevo.`);
        } finally {
            setLoading(false);
        }
    };

    const renderRadioGroup = (name: string, options: string[]) => (
        <div className="radio-group">
            {options.map(option => (
                <label key={option} className="radio-label">
                    <input 
                        type="radio" 
                        name={name} 
                        value={option} 
                        checked={formData[name as keyof typeof formData] === option}
                        onChange={() => handleRadioChange(name, option)}
                        disabled={loading}
                    />
                    {option}
                </label>
            ))}
        </div>
    );

    return (
        <>
            <div className="form-panel">
                <div className="header">
                    <h1>RutIA</h1>
                    <h2>Tu Coach de Fitness Personalizado con IA</h2>
                </div>

                <div className="form-group">
                    <label>Género</label>
                    {renderRadioGroup('genero', ['Hombre', 'Mujer'])}
                </div>

                <div className="form-group">
                    <label htmlFor="edad">Edad (años)</label>
                    <input type="number" id="edad" name="edad" value={formData.edad} onChange={handleInputChange} disabled={loading} placeholder="Ej: 30" />
                </div>
                
                <div className="form-group">
                    <label htmlFor="altura">Altura</label>
                    <div className="input-group">
                         <input type="number" id="altura" name="altura" value={formData.altura} onChange={handleInputChange} disabled={loading} placeholder="Ej: 175" />
                         <select name="alturaUnidad" value={formData.alturaUnidad} onChange={handleInputChange} disabled={loading}>
                             <option value="cm">cm</option>
                             <option value="m">m</option>
                         </select>
                    </div>
                </div>
                
                <div className="form-group">
                    <label htmlFor="peso">Peso (kg)</label>
                    <input type="number" id="peso" name="peso" value={formData.peso} onChange={handleInputChange} disabled={loading} placeholder="Ej: 70" />
                </div>
                
                <div className="form-group">
                    <label htmlFor="masaMuscular">Masa Muscular (%)</label>
                    <input type="number" id="masaMuscular" name="masaMuscular" value={formData.masaMuscular} onChange={handleInputChange} disabled={loading} placeholder="Ej: 40" />
                </div>
                
                <div className="form-group">
                    <label htmlFor="grasaCorporal">Grasa Corporal (%)</label>
                    <input type="number" id="grasaCorporal" name="grasaCorporal" value={formData.grasaCorporal} onChange={handleInputChange} disabled={loading} placeholder="Ej: 15" />
                </div>
                
                <div className="form-group">
                    <label>Meta Principal</label>
                    {renderRadioGroup('meta', ['Bajar de peso', 'Ganar músculo', 'Estar en forma', 'Salud'])}
                </div>
                
                <div className="form-group">
                    <label>Tiempo Disponible</label>
                    {renderRadioGroup('tiempo', ['Máx. 3 días/semana', 'Fines de semana', 'Coach decide'])}
                </div>

                <div className="form-group">
                    <label>Lugar de Entrenamiento</label>
                    {renderRadioGroup('lugar', ['Gym', 'Casa', 'Parque'])}
                </div>

                {!isGym && (
                    <div className="form-group">
                        <label>Material</label>
                        {renderRadioGroup('material', ['Cuento con material', 'No cuento con material'])}
                    </div>
                )}
                
                <div className="form-group">
                    <label htmlFor="screening">Lesiones o patologías a considerar</label>
                    <textarea id="screening" name="screening" value={formData.screening} onChange={handleInputChange} disabled={loading} placeholder="Ej: Dolor lumbar, evito impacto en rodillas..."></textarea>
                </div>

                <button onClick={handleGenerateRutina} disabled={loading || !isFormValid}>
                    {loading ? 'Generando Rutina...' : 'Generar Rutina'}
                </button>
            </div>
            <div className="result-panel">
                {loading && (
                    <div className="loading-state">
                        <h3>Tu coach IA está creando tu plan personalizado...</h3>
                        <p>Esto puede tardar un momento. ¡Gracias por tu paciencia!</p>
                    </div>
                )}
                {error && <div className="error">{error}</div>}
                {routine && (
                    <div className="routine-container">
                        <h2>{routine.title}</h2>
                        <p className="intro-text">{routine.introduction}</p>

                        {routine.weeklyPlan.map(week => (
                            <div key={week.week} className="week-plan">
                                <h3 className="week-title">Semana {week.week}</h3>
                                {week.plan.map((day, dayIndex) => (
                                    <div key={dayIndex} className="day-plan">
                                        <h4>{day.day}</h4>
                                        <div className="exercises-grid">
                                            {day.exercises.map(exercise => (
                                                <div key={exercise.name} className="exercise-card">
                                                    <div className="exercise-image-container">
                                                        {exercise.imageUrl ? (
                                                            <img 
                                                                src={exercise.imageUrl}
                                                                alt={`Ilustración de ${exercise.name}`} 
                                                                className="exercise-image"
                                                                loading="lazy"
                                                            />
                                                        ) : (
                                                            <div className="image-placeholder">
                                                                <span>Generando imagen...</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="exercise-info">
                                                        <h5>{exercise.name}</h5>
                                                        <ul className="exercise-details">
                                                            <li><strong>Series:</strong> {exercise.sets}</li>
                                                            <li><strong>Reps:</strong> {exercise.reps}</li>
                                                            <li className="rpe-container">
                                                                <strong>RPE:</strong> {exercise.rpe}
                                                                <span className="info-icon">ⓘ</span>
                                                                <span className="tooltip-text">
                                                                    <b>Tasa de Esfuerzo Percibido (RPE):</b> Es una escala de 1 a 10 sobre qué tan duro sientes que estás trabajando. Un RPE de {exercise.rpe} significa que el esfuerzo es alto y deberías sentir que te quedan solo 2-3 repeticiones en reserva.
                                                                </span>
                                                            </li>
                                                            <li><strong>Descanso:</strong> {exercise.rest}</li>
                                                        </ul>
                                                        <p className="exercise-desc">{exercise.description}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}
                         <div className="final-section">
                            <h3>Consejos de Nutrición y Descanso</h3>
                             <div className="advice-cards">
                                 <div className="advice-card">
                                     <h6>Proteína</h6>
                                     <p>{routine.nutritionAdvice.protein}</p>
                                 </div>
                                  <div className="advice-card">
                                     <h6>Hidratación</h6>
                                     <p>{routine.nutritionAdvice.hydration}</p>
                                 </div>
                                  <div className="advice-card">
                                     <h6>Sueño</h6>
                                     <p>{routine.nutritionAdvice.sleep}</p>
                                 </div>
                             </div>
                        </div>
                        <div className="final-section">
                            <h3>¡A por ello!</h3>
                            <p>{routine.finalMessage}</p>
                        </div>
                    </div>
                )}
                {!loading && !routine && !error && (
                    <div className="placeholder">
                         <h2>Bienvenido a RutIA</h2>
                         <p>Completa el formulario con tus datos para generar un plan de entrenamiento y nutrición 100% personalizado.</p>
                    </div>
                )}
            </div>
        </>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<React.StrictMode><App /></React.StrictMode>);