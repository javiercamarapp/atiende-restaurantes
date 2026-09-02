import { useState, useRef } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useIsAdmin } from '@/hooks/useIsAdmin';

interface MenuItemImageProps {
  image?: string;
  itemName: string;
  itemId: string;
  categoryIcon: string;
  size?: 'sm' | 'lg';
  onImageUploaded?: (url: string) => void;
}

const MenuItemImage = ({ 
  image, 
  itemName, 
  itemId,
  categoryIcon, 
  size = 'lg',
  onImageUploaded 
}: MenuItemImageProps) => {
  const { isAdmin } = useIsAdmin();
  const [uploading, setUploading] = useState(false);
  const [currentImage, setCurrentImage] = useState(image);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = (e: React.MouseEvent) => {
    if (isAdmin && !currentImage) {
      e.stopPropagation();
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor selecciona una imagen válida');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen debe ser menor a 5MB');
      return;
    }

    setUploading(true);

    try {
      // Create unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${itemId}-${Date.now()}.${fileExt}`;

      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName);

      // Update product in database by ID
      const { error: updateError } = await supabase
        .from('products')
        .update({ image_url: publicUrl })
        .eq('id', itemId);

      if (updateError) {
        console.error('Could not update product in database:', updateError);
        throw updateError;
      }

      setCurrentImage(publicUrl);
      onImageUploaded?.(publicUrl);
      toast.success('Imagen subida correctamente');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Error al subir la imagen');
    } finally {
      setUploading(false);
    }
  };

  const heightClass = size === 'sm' ? 'h-28' : 'h-48';
  const iconSize = size === 'sm' ? 'text-4xl' : 'text-6xl';

  return (
    <div className={`relative ${heightClass} bg-gradient-to-br from-secondary to-muted overflow-hidden`}>
      {currentImage ? (
        <img 
          src={currentImage} 
          alt={itemName} 
          className={`absolute inset-0 w-full h-full object-cover ${size === 'lg' ? 'group-hover:scale-110 transition-transform duration-500' : ''}`}
        />
      ) : (
        <div 
          onClick={handleClick}
          className={`absolute inset-0 flex items-center justify-center ${iconSize} opacity-50 ${size === 'lg' ? 'group-hover:scale-110 transition-transform duration-500' : ''} ${isAdmin ? 'cursor-pointer hover:opacity-70' : ''}`}
        >
          {uploading ? (
            <Loader2 className="w-8 h-8 animate-spin text-gold" />
          ) : isAdmin ? (
            <div className="flex flex-col items-center gap-2">
              <Upload className={size === 'sm' ? 'w-6 h-6' : 'w-10 h-10'} />
              <span className={`${size === 'sm' ? 'text-[10px]' : 'text-xs'} text-white/70`}>Subir imagen</span>
            </div>
          ) : (
            categoryIcon
          )}
        </div>
      )}
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
};

export default MenuItemImage;
