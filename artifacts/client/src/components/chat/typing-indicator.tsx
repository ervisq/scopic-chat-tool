import { motion } from "framer-motion";

export function TypingIndicator() {
  const containerVariants = {
    initial: { opacity: 0, scale: 0.8, y: 10 },
    animate: { 
      opacity: 1, 
      scale: 1, 
      y: 0,
      transition: { duration: 0.3, ease: "easeOut" }
    }
  };

  const dotVariants = {
    animate: {
      y: [0, -5, 0],
      opacity: [0.4, 1, 0.4],
      transition: {
        duration: 1.2,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="initial"
      animate="animate"
      className="flex items-end gap-2 mb-6"
    >
      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary/10 to-primary/5 flex items-center justify-center border border-primary/10 shadow-sm shrink-0">
        <div className="w-2.5 h-2.5 rounded-full bg-primary/40" />
      </div>
      
      <div className="bg-card border shadow-sm shadow-black/5 px-4 py-3.5 rounded-2xl rounded-bl-sm flex items-center gap-1.5 h-[44px]">
        <motion.div 
          className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60" 
          variants={dotVariants} 
          animate="animate" 
        />
        <motion.div 
          className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60" 
          variants={dotVariants} 
          animate="animate" 
          transition={{ delay: 0.2 }}
        />
        <motion.div 
          className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60" 
          variants={dotVariants} 
          animate="animate" 
          transition={{ delay: 0.4 }}
        />
      </div>
    </motion.div>
  );
}
