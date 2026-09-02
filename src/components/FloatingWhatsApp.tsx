import { useEffect, useState } from 'react';
import whatsappLogo from '@/assets/whatsapp-floating.png';

// Branch WhatsApp numbers mapping
const branchWhatsApp: Record<string, string> = {
  altabrisa: '529995182857',
  'garcia-lavin': '529995182637',
  'prol-montejo': '529999440342',
  'fco-montejo': '529999537122',
  galerias: '529995182857', // Default to Altabrisa
  chicxulub: '529696884195',
  pensiones: '529999875410',
};

// Branch coordinates for distance calculation
const branchCoordinates: Record<string, { lat: number; lng: number }> = {
  altabrisa: { lat: 20.9847, lng: -89.5886 },
  'garcia-lavin': { lat: 21.0167, lng: -89.6000 },
  'prol-montejo': { lat: 21.0200, lng: -89.6150 },
  'fco-montejo': { lat: 21.0267, lng: -89.6267 },
  galerias: { lat: 21.0400, lng: -89.6200 },
  chicxulub: { lat: 21.2950, lng: -89.6000 },
  pensiones: { lat: 20.9800, lng: -89.6300 },
};

const defaultBranch = 'altabrisa';

function getDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function findNearestBranch(userLat: number, userLng: number): string {
  let nearestBranch = defaultBranch;
  let minDistance = Infinity;

  Object.entries(branchCoordinates).forEach(([branchId, coords]) => {
    const distance = getDistance(userLat, userLng, coords.lat, coords.lng);
    if (distance < minDistance) {
      minDistance = distance;
      nearestBranch = branchId;
    }
  });

  return nearestBranch;
}

const FloatingWhatsApp = () => {
  const [selectedBranch, setSelectedBranch] = useState<string>(defaultBranch);

  useEffect(() => {
    // First check localStorage for saved branch preference
    const savedBranch = localStorage.getItem('selectedBranch');
    if (savedBranch && branchWhatsApp[savedBranch]) {
      setSelectedBranch(savedBranch);
      return;
    }

    // Try to get user's location for nearest branch
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const nearestBranch = findNearestBranch(
            position.coords.latitude,
            position.coords.longitude
          );
          setSelectedBranch(nearestBranch);
        },
        () => {
          // If geolocation fails, use default
          setSelectedBranch(defaultBranch);
        }
      );
    }
  }, []);

  const whatsappNumber = branchWhatsApp[selectedBranch] || branchWhatsApp[defaultBranch];
  const whatsappUrl = `https://api.whatsapp.com/send?phone=${whatsappNumber}&text=Hola%20quisiera%20ordenar`;

  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 hover:scale-110 transition-transform duration-300 drop-shadow-lg"
      aria-label="Contactar por WhatsApp"
    >
      <img src={whatsappLogo} alt="WhatsApp" className="w-14 h-14" />
    </a>
  );
};

export default FloatingWhatsApp;
