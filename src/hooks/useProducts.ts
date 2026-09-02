import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MenuItem, categories, CategoryId } from '@/data/menu';

interface DbProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_popular: boolean | null;
  is_available: boolean | null;
  category_id: string | null;
}

interface DbCategory {
  id: string;
  name: string;
  slug: string;
  display_order: number | null;
}

// Map database category slugs to local category icons
const categoryIconMap: Record<string, string> = {
  'tacos': '🌮',
  'tacos-individuales': '🌮',
  'gringas': '🫓',
  'mestizas': '🫓',
  'alambre': '🥘',
  'chetacos': '🌯',
  'papas': '🥔',
  'frances-suizo': '🥖',
  'tacos-suizos': '🧀',
  'entradas': '🍽️',
  'frijoles-charros': '🫘',
  'quesadillas': '🧀',
  'queso-fundido': '🧀',
  'nachos': '🌽',
  'comida-regional': '🍲',
  'flautas': '🌯',
  'platillos': '🍽️',
  'postres': '🍮',
  'aguas-frescas': '🥤',
  'refrescos': '🥤',
  'cervezas': '🍺',
  'hamburguesas': '🍔',
  'extras': '➕',
  'kilos': '📦',
  'pizza': '🍕',
  'licores': '🥃',
};

export function useProducts() {
  const [products, setProducts] = useState<MenuItem[]>([]);
  const [dbCategories, setDbCategories] = useState<DbCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      
      // Fetch categories first
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('*')
        .order('display_order');

      if (categoriesError) throw categoriesError;
      setDbCategories(categoriesData || []);

      // Fetch products
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('is_available', true)
        .order('display_order');

      if (productsError) throw productsError;

      // Map products to MenuItem format
      const mappedProducts: MenuItem[] = (productsData || []).map((product: DbProduct) => {
        const category = categoriesData?.find(c => c.id === product.category_id);
        const categorySlug = category?.slug || 'tacos';
        
        return {
          id: product.id,
          name: product.name,
          description: product.description || '',
          price: product.price,
          image: product.image_url || '',
          category: categorySlug as CategoryId,
          popular: product.is_popular || false,
        };
      });

      setProducts(mappedProducts);
    } catch (err) {
      console.error('Error fetching products:', err);
      setError(err instanceof Error ? err.message : 'Error loading products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Get merged categories (DB categories with icons)
  const mergedCategories = dbCategories.map(cat => ({
    id: cat.slug,
    name: cat.name,
    icon: categoryIconMap[cat.slug] || '🍽️',
  }));

  return { 
    products, 
    categories: mergedCategories.length > 0 ? mergedCategories : categories,
    loading, 
    error,
    refetch: fetchProducts,
  };
}
