import { useState, useCallback } from 'react'
import PropTypes from 'prop-types'
import styled from 'styled-components'

const GalleryContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
`

const ConceptCard = styled.div`
  background: ${props => props.theme?.colors?.background?.primary || '#ffffff'};
  border: 1px solid ${props => props.theme?.colors?.border || '#dee2e6'};
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.2s ease;
  cursor: pointer;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
`

const ConceptImage = styled.div`
  width: 100%;
  height: 200px;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  background-image: url(${props => props.src});
  position: relative;
  
  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(to bottom, transparent 60%, rgba(0, 0, 0, 0.7));
  }
`

const ConceptInfo = styled.div`
  padding: 16px;
  
  h4 {
    margin: 0 0 8px 0;
    font-size: 16px;
    font-weight: 600;
    color: ${props => props.theme?.colors?.text?.primary || '#212529'};
  }
  
  p {
    margin: 0;
    font-size: 14px;
    color: ${props => props.theme?.colors?.text?.secondary || '#6c757d'};
    line-height: 1.4;
  }
  
  .concept-type {
    display: inline-block;
    padding: 4px 8px;
    background: ${props => props.theme?.colors?.primary || '#007bff'};
    color: white;
    font-size: 12px;
    font-weight: 500;
    border-radius: 12px;
    text-transform: capitalize;
    margin-top: 8px;
  }
`

const DocumentIcon = styled.div`
  width: 100%;
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${props => props.theme?.colors?.background?.secondary || '#f8f9fa'};
  color: ${props => props.theme?.colors?.text?.secondary || '#6c757d'};
  font-size: 48px;
  
  &::before {
    content: '📄';
  }
`

const LightboxOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
`

const LightboxContent = styled.div`
  max-width: 90vw;
  max-height: 90vh;
  position: relative;
  
  img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
  
  iframe {
    width: 80vw;
    height: 80vh;
    border: none;
    background: white;
  }
`

const LightboxClose = styled.button`
  position: absolute;
  top: -40px;
  right: 0;
  background: none;
  border: none;
  color: white;
  font-size: 24px;
  cursor: pointer;
  padding: 8px;
  
  &:hover {
    opacity: 0.7;
  }
`

const LightboxInfo = styled.div`
  position: absolute;
  bottom: -60px;
  left: 0;
  right: 0;
  color: white;
  text-align: center;
  
  h3 {
    margin: 0 0 8px 0;
    font-size: 18px;
  }
  
  p {
    margin: 0;
    font-size: 14px;
    opacity: 0.8;
  }
`

/**
 * Concept Gallery Component
 * Displays proposal concepts/assets with lightbox functionality
 * @param {Object} props - Component props
 * @param {Array} props.concepts - Array of concept objects
 */
const ConceptGallery = ({ concepts }) => {
  const [lightboxConcept, setLightboxConcept] = useState(null)
  
  const openLightbox = useCallback((concept) => {
    setLightboxConcept(concept)
  }, [])
  
  const closeLightbox = useCallback(() => {
    setLightboxConcept(null)
  }, [])
  
  const handleKeyDown = useCallback((event) => {
    if (event.key === 'Escape') {
      closeLightbox()
    }
  }, [closeLightbox])
  
  // Add keyboard listener for lightbox
  useState(() => {
    if (lightboxConcept) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [lightboxConcept, handleKeyDown])
  
  const isImage = useCallback((concept) => {
    return concept.type === 'wireframe' || concept.type === 'mockup' || 
           (concept.url && concept.url.match(/\.(jpg|jpeg|png|gif|webp)$/i))
  }, [])
  
  const isPDF = useCallback((concept) => {
    return concept.type === 'document' || 
           (concept.url && concept.url.match(/\.pdf$/i))
  }, [])
  
  if (!concepts || concepts.length === 0) {
    return null
  }
  
  return (
    <>
      <GalleryContainer>
        {concepts
          .sort((a, b) => (a.order || 0) - (b.order || 0))
          .map((concept) => (
            <ConceptCard
              key={concept.id}
              onClick={() => openLightbox(concept)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  openLightbox(concept)
                }
              }}
            >
              {isImage(concept) ? (
                <ConceptImage src={concept.thumbnailUrl || concept.url} />
              ) : (
                <DocumentIcon />
              )}
              
              <ConceptInfo>
                <h4>{concept.title}</h4>
                {concept.description && (
                  <p>{concept.description}</p>
                )}
                <div className="concept-type">
                  {concept.type}
                </div>
              </ConceptInfo>
            </ConceptCard>
          ))}
      </GalleryContainer>
      
      {/* Lightbox */}
      {lightboxConcept && (
        <LightboxOverlay
          onClick={closeLightbox}
          role="dialog"
          aria-modal="true"
          aria-labelledby="lightbox-title"
        >
          <LightboxContent onClick={(e) => e.stopPropagation()}>
            <LightboxClose
              onClick={closeLightbox}
              aria-label="Close lightbox"
            >
              ✕
            </LightboxClose>
            
            {isImage(lightboxConcept) ? (
              <img
                src={lightboxConcept.url}
                alt={lightboxConcept.title}
                loading="lazy"
              />
            ) : isPDF(lightboxConcept) ? (
              <iframe
                src={lightboxConcept.url}
                title={lightboxConcept.title}
                loading="lazy"
              />
            ) : (
              <div style={{
                background: 'white',
                padding: '40px',
                borderRadius: '8px',
                textAlign: 'center',
                maxWidth: '400px'
              }}>
                <h3>Document Preview</h3>
                <p>{lightboxConcept.title}</p>
                <a
                  href={lightboxConcept.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-block',
                    padding: '12px 24px',
                    background: '#007bff',
                    color: 'white',
                    textDecoration: 'none',
                    borderRadius: '4px',
                    marginTop: '16px'
                  }}
                >
                  Open Document
                </a>
              </div>
            )}
            
            <LightboxInfo>
              <h3 id="lightbox-title">{lightboxConcept.title}</h3>
              {lightboxConcept.description && (
                <p>{lightboxConcept.description}</p>
              )}
            </LightboxInfo>
          </LightboxContent>
        </LightboxOverlay>
      )}
    </>
  )
}

ConceptGallery.propTypes = {
  concepts: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      title: PropTypes.string.isRequired,
      description: PropTypes.string,
      type: PropTypes.oneOf(['wireframe', 'mockup', 'video', 'document']).isRequired,
      url: PropTypes.string.isRequired,
      thumbnailUrl: PropTypes.string,
      order: PropTypes.number
    })
  ).isRequired
}

export default ConceptGallery