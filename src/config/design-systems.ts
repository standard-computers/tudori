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
 ];
 
 export const getDesignSystem = (id: string): DesignSystem => {
   return designSystems.find(ds => ds.id === id) || designSystems[0];
 };
 
 export const applyDesignSystem = (designSystemId: string, theme: 'light' | 'dark') => {
   const ds = getDesignSystem(designSystemId);
   const variables = ds.variables[theme];
   
   Object.entries(variables).forEach(([key, value]) => {
     document.documentElement.style.setProperty(key, value);
   });
 };