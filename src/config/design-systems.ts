 export interface DesignSystem {
   id: string;
   name: string;
   description: string;
   preview: string; // CSS color for preview swatch
   variables: {
     light: Record<string, string>;
     dark: Record<string, string>;
   };
 }
 
 export const designSystems: DesignSystem[] = [
   {
     id: 'default',
     name: 'Enterprise Navy',
     description: 'Professional deep navy with warm accents',
     preview: 'hsl(222, 47%, 18%)',
     variables: {
       light: {
         '--primary': '222 47% 18%',
         '--primary-foreground': '210 40% 98%',
         '--accent': '220 10% 45%',
         '--accent-foreground': '0 0% 100%',
         '--sidebar-background': '222 47% 12%',
         '--sidebar-foreground': '210 40% 96%',
         '--sidebar-primary': '220 10% 45%',
         '--sidebar-accent': '222 40% 20%',
       },
       dark: {
         '--primary': '220 10% 45%',
         '--primary-foreground': '0 0% 100%',
         '--accent': '220 10% 45%',
         '--accent-foreground': '0 0% 100%',
         '--sidebar-background': '222 47% 6%',
         '--sidebar-foreground': '210 40% 96%',
         '--sidebar-primary': '220 10% 45%',
         '--sidebar-accent': '222 40% 14%',
       },
     },
   },
   {
     id: 'ocean',
     name: 'Ocean Blue',
     description: 'Cool oceanic blues with teal undertones',
     preview: 'hsl(200, 70%, 35%)',
     variables: {
       light: {
         '--primary': '200 70% 35%',
         '--primary-foreground': '0 0% 100%',
         '--accent': '185 60% 40%',
         '--accent-foreground': '0 0% 100%',
         '--sidebar-background': '200 70% 20%',
         '--sidebar-foreground': '200 20% 96%',
         '--sidebar-primary': '185 60% 40%',
         '--sidebar-accent': '200 60% 28%',
       },
       dark: {
         '--primary': '200 60% 50%',
         '--primary-foreground': '200 70% 10%',
         '--accent': '185 50% 45%',
         '--accent-foreground': '0 0% 100%',
         '--sidebar-background': '200 70% 8%',
         '--sidebar-foreground': '200 20% 96%',
         '--sidebar-primary': '185 50% 45%',
         '--sidebar-accent': '200 60% 15%',
       },
     },
   },
   {
     id: 'forest',
     name: 'Forest Green',
     description: 'Natural greens inspired by woodland',
     preview: 'hsl(150, 40%, 30%)',
     variables: {
       light: {
         '--primary': '150 40% 30%',
         '--primary-foreground': '0 0% 100%',
         '--accent': '140 35% 40%',
         '--accent-foreground': '0 0% 100%',
         '--sidebar-background': '150 40% 18%',
         '--sidebar-foreground': '150 20% 96%',
         '--sidebar-primary': '140 35% 40%',
         '--sidebar-accent': '150 35% 25%',
       },
       dark: {
         '--primary': '150 35% 45%',
         '--primary-foreground': '150 40% 10%',
         '--accent': '140 30% 45%',
         '--accent-foreground': '0 0% 100%',
         '--sidebar-background': '150 40% 8%',
         '--sidebar-foreground': '150 20% 96%',
         '--sidebar-primary': '140 30% 45%',
         '--sidebar-accent': '150 35% 14%',
       },
     },
   },
   {
     id: 'slate',
     name: 'Slate Gray',
     description: 'Minimalist neutral gray palette',
     preview: 'hsl(215, 16%, 35%)',
     variables: {
       light: {
         '--primary': '215 16% 35%',
         '--primary-foreground': '0 0% 100%',
         '--accent': '215 12% 50%',
         '--accent-foreground': '0 0% 100%',
         '--sidebar-background': '215 16% 22%',
         '--sidebar-foreground': '215 10% 96%',
         '--sidebar-primary': '215 12% 50%',
         '--sidebar-accent': '215 14% 30%',
       },
       dark: {
         '--primary': '215 12% 55%',
         '--primary-foreground': '215 16% 10%',
         '--accent': '215 10% 55%',
         '--accent-foreground': '0 0% 100%',
         '--sidebar-background': '215 16% 8%',
         '--sidebar-foreground': '215 10% 96%',
         '--sidebar-primary': '215 10% 55%',
         '--sidebar-accent': '215 14% 15%',
       },
     },
   },
    {
      id: 'burgundy',
      name: 'Executive Burgundy',
      description: 'Rich wine tones for a premium feel',
      preview: 'hsl(345, 45%, 30%)',
      variables: {
        light: {
          '--primary': '345 45% 30%',
          '--primary-foreground': '0 0% 100%',
          '--accent': '345 35% 45%',
          '--accent-foreground': '0 0% 100%',
          '--sidebar-background': '345 45% 18%',
          '--sidebar-foreground': '345 20% 96%',
          '--sidebar-primary': '345 35% 45%',
          '--sidebar-accent': '345 40% 25%',
        },
        dark: {
          '--primary': '345 40% 50%',
          '--primary-foreground': '345 45% 10%',
          '--accent': '345 35% 50%',
          '--accent-foreground': '0 0% 100%',
          '--sidebar-background': '345 45% 8%',
          '--sidebar-foreground': '345 20% 96%',
          '--sidebar-primary': '345 35% 50%',
          '--sidebar-accent': '345 40% 14%',
        },
      },
    },
    {
      id: 'amber',
      name: 'Warm Amber',
      description: 'Warm golden tones with earthy feel',
      preview: 'hsl(35, 60%, 40%)',
      variables: {
        light: {
          '--primary': '35 60% 40%',
          '--primary-foreground': '0 0% 100%',
          '--accent': '30 50% 45%',
          '--accent-foreground': '0 0% 100%',
          '--sidebar-background': '35 60% 22%',
          '--sidebar-foreground': '35 20% 96%',
          '--sidebar-primary': '30 50% 45%',
          '--sidebar-accent': '35 55% 28%',
        },
        dark: {
          '--primary': '35 55% 50%',
          '--primary-foreground': '35 60% 10%',
          '--accent': '30 45% 50%',
          '--accent-foreground': '0 0% 100%',
          '--sidebar-background': '35 60% 8%',
          '--sidebar-foreground': '35 20% 96%',
          '--sidebar-primary': '30 45% 50%',
          '--sidebar-accent': '35 55% 14%',
        },
      },
    },
    {
      id: 'violet',
      name: 'Royal Violet',
      description: 'Deep purple with regal elegance',
      preview: 'hsl(270, 50%, 35%)',
      variables: {
        light: {
          '--primary': '270 50% 35%',
          '--primary-foreground': '0 0% 100%',
          '--accent': '265 40% 45%',
          '--accent-foreground': '0 0% 100%',
          '--sidebar-background': '270 50% 20%',
          '--sidebar-foreground': '270 20% 96%',
          '--sidebar-primary': '265 40% 45%',
          '--sidebar-accent': '270 45% 28%',
        },
        dark: {
          '--primary': '270 45% 55%',
          '--primary-foreground': '270 50% 10%',
          '--accent': '265 35% 55%',
          '--accent-foreground': '0 0% 100%',
          '--sidebar-background': '270 50% 8%',
          '--sidebar-foreground': '270 20% 96%',
          '--sidebar-primary': '265 35% 55%',
          '--sidebar-accent': '270 45% 15%',
        },
      },
    },
    {
      id: 'rose',
      name: 'Modern Rose',
      description: 'Soft pink with contemporary style',
      preview: 'hsl(330, 50%, 40%)',
      variables: {
        light: {
          '--primary': '330 50% 40%',
          '--primary-foreground': '0 0% 100%',
          '--accent': '325 40% 48%',
          '--accent-foreground': '0 0% 100%',
          '--sidebar-background': '330 50% 22%',
          '--sidebar-foreground': '330 20% 96%',
          '--sidebar-primary': '325 40% 48%',
          '--sidebar-accent': '330 45% 28%',
        },
        dark: {
          '--primary': '330 45% 55%',
          '--primary-foreground': '330 50% 10%',
          '--accent': '325 35% 55%',
          '--accent-foreground': '0 0% 100%',
          '--sidebar-background': '330 50% 8%',
          '--sidebar-foreground': '330 20% 96%',
          '--sidebar-primary': '325 35% 55%',
          '--sidebar-accent': '330 45% 14%',
        },
      },
    },
    {
      id: 'copper',
      name: 'Industrial Copper',
      description: 'Metallic copper with industrial edge',
      preview: 'hsl(20, 55%, 38%)',
      variables: {
        light: {
          '--primary': '20 55% 38%',
          '--primary-foreground': '0 0% 100%',
          '--accent': '15 45% 45%',
          '--accent-foreground': '0 0% 100%',
          '--sidebar-background': '20 55% 20%',
          '--sidebar-foreground': '20 20% 96%',
          '--sidebar-primary': '15 45% 45%',
          '--sidebar-accent': '20 50% 26%',
        },
        dark: {
          '--primary': '20 50% 50%',
          '--primary-foreground': '20 55% 10%',
          '--accent': '15 40% 50%',
          '--accent-foreground': '0 0% 100%',
          '--sidebar-background': '20 55% 8%',
          '--sidebar-foreground': '20 20% 96%',
          '--sidebar-primary': '15 40% 50%',
          '--sidebar-accent': '20 50% 14%',
        },
      },
    },
    {
      id: 'midnight',
      name: 'Midnight Blue',
      description: 'Deep midnight with electric accents',
      preview: 'hsl(235, 50%, 28%)',
      variables: {
        light: {
          '--primary': '235 50% 28%',
          '--primary-foreground': '0 0% 100%',
          '--accent': '230 40% 40%',
          '--accent-foreground': '0 0% 100%',
          '--sidebar-background': '235 50% 16%',
          '--sidebar-foreground': '235 20% 96%',
          '--sidebar-primary': '230 40% 40%',
          '--sidebar-accent': '235 45% 22%',
        },
        dark: {
          '--primary': '235 45% 55%',
          '--primary-foreground': '235 50% 10%',
          '--accent': '230 35% 55%',
          '--accent-foreground': '0 0% 100%',
          '--sidebar-background': '235 50% 8%',
          '--sidebar-foreground': '235 20% 96%',
          '--sidebar-primary': '230 35% 55%',
          '--sidebar-accent': '235 45% 14%',
        },
      },
    },
  ];
 
export const getDesignSystem = (id: string): DesignSystem => {
  return designSystems.find(ds => ds.id === id) || designSystems[0];
};

export const buildCustomDesignSystem = (hue: number, saturation: number, lightness: number): DesignSystem => {
  return {
    id: 'custom',
    name: 'Custom',
    description: 'Your custom color',
    preview: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
    variables: {
      light: {
        '--primary': `${hue} ${saturation}% ${lightness}%`,
        '--primary-foreground': '0 0% 100%',
        '--accent': `${hue} ${Math.max(saturation - 10, 10)}% ${Math.min(lightness + 10, 55)}%`,
        '--accent-foreground': '0 0% 100%',
        '--sidebar-background': `${hue} ${saturation}% ${Math.max(lightness - 15, 10)}%`,
        '--sidebar-foreground': `${hue} 20% 96%`,
        '--sidebar-primary': `${hue} ${Math.max(saturation - 10, 10)}% ${Math.min(lightness + 10, 55)}%`,
        '--sidebar-accent': `${hue} ${Math.max(saturation - 5, 10)}% ${Math.max(lightness - 8, 15)}%`,
      },
      dark: {
        '--primary': `${hue} ${Math.max(saturation - 5, 10)}% ${Math.min(lightness + 15, 60)}%`,
        '--primary-foreground': `${hue} ${saturation}% 10%`,
        '--accent': `${hue} ${Math.max(saturation - 15, 10)}% ${Math.min(lightness + 15, 60)}%`,
        '--accent-foreground': '0 0% 100%',
        '--sidebar-background': `${hue} ${saturation}% 8%`,
        '--sidebar-foreground': `${hue} 20% 96%`,
        '--sidebar-primary': `${hue} ${Math.max(saturation - 15, 10)}% ${Math.min(lightness + 15, 60)}%`,
        '--sidebar-accent': `${hue} ${Math.max(saturation - 5, 10)}% 14%`,
      },
    },
  };
};

export const applyDesignSystem = (designSystemId: string, theme: 'light' | 'dark', customHsl?: { h: number; s: number; l: number }) => {
  const ds = designSystemId === 'custom' && customHsl
    ? buildCustomDesignSystem(customHsl.h, customHsl.s, customHsl.l)
    : getDesignSystem(designSystemId);
  const variables = ds?.variables?.[theme];
  if (!variables) return;
  
  Object.entries(variables).forEach(([key, value]) => {
    document.documentElement.style.setProperty(key, value);
  });
};