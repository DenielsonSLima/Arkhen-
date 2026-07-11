import React, { useRef, useState, useEffect } from 'react';
import { Calculator, X, Move } from 'lucide-react';
import { useFloatingCalculator } from '../../hooks/useFloatingCalculator';
import { CalculatorSelector } from './CalculatorSelector';
import { NormalCalculator } from './models/NormalCalculator';
import { AccountingCalculator } from './models/AccountingCalculator';
import { TaxCalculator } from './models/TaxCalculator';
import {
  type CalculatorPosition,
  type CalculatorResizeMode,
  type CalculatorSize,
  getCalculatorTriggerRight,
  getSafeCalculatorPosition,
  getSafeCalculatorSize,
} from './calculatorGeometry';
import './Calculator.css';

interface FloatingCalculatorProps {
  userId?: string;
  openInternalChatsCount?: number;
}

export const FloatingCalculator: React.FC<FloatingCalculatorProps> = ({
  userId,
  openInternalChatsCount = 0,
}) => {
  const {
    isOpen,
    position,
    size,
    activeModel,
    setPosition,
    setSize,
    closeCalculator,
    toggleCalculator,
    initDefaultModel
  } = useFloatingCalculator();

  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeState, setResizeState] = useState<{
    mode: CalculatorResizeMode;
    startPointer: CalculatorPosition;
    startSize: CalculatorSize;
    startPosition: CalculatorPosition;
  } | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [viewportTick, setViewportTick] = useState(0);
  const calculatorRef = useRef<HTMLDivElement>(null);
  const hasOpenInternalChats = openInternalChatsCount > 0;

  // Inicializar modelo padrão conforme usuário
  useEffect(() => {
    if (userId) {
      initDefaultModel(userId);
    }
  }, [initDefaultModel, userId]);

  // Verificar responsividade
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      setViewportTick(current => current + 1);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (isMobile || !isOpen) return;

    const safeSize = getSafeCalculatorSize(size);
    if (safeSize.width !== size.width || safeSize.height !== size.height) {
      setSize(safeSize);
      return;
    }

    const safePosition = getSafeCalculatorPosition(position, safeSize, openInternalChatsCount);
    if (safePosition.x !== position.x || safePosition.y !== position.y) {
      setPosition(safePosition);
    }
  }, [isMobile, isOpen, openInternalChatsCount, position, setPosition, setSize, size, viewportTick]);

  useEffect(() => {
    if (!isOpen || isMobile) return;
    window.setTimeout(() => calculatorRef.current?.focus(), 0);
  }, [activeModel, isMobile, isOpen]);

  // Handlers do Drag
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isMobile) return; // No mobile é modal fixo
    
    // Permitir arrastar apenas pelo header ou pelo ícone de mover
    const target = e.target as HTMLElement;
    if (!target.closest('.calculator-header') || target.closest('.header-btn')) return;

    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
    
    // Capturar o ponteiro para receber eventos mesmo fora do elemento
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (resizeState) {
      const deltaX = e.clientX - resizeState.startPointer.x;
      const deltaY = e.clientY - resizeState.startPointer.y;
      const nextSize = getSafeCalculatorSize({
        width: resizeState.mode === 'bottom' ? resizeState.startSize.width : resizeState.startSize.width + deltaX,
        height: resizeState.mode === 'right' ? resizeState.startSize.height : resizeState.startSize.height + deltaY,
      });
      const nextPosition = getSafeCalculatorPosition(
        resizeState.startPosition,
        nextSize,
        openInternalChatsCount,
      );

      setSize(nextSize);
      setPosition(nextPosition);
      return;
    }

    if (!isDragging) return;

    const nextPosition = getSafeCalculatorPosition(
      {
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      },
      size,
      openInternalChatsCount,
    );

    setPosition(nextPosition);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging || resizeState) {
      setIsDragging(false);
      setResizeState(null);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  const handleResizePointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
    mode: CalculatorResizeMode,
  ) => {
    if (isMobile) return;

    event.preventDefault();
    event.stopPropagation();
    setResizeState({
      mode,
      startPointer: { x: event.clientX, y: event.clientY },
      startSize: size,
      startPosition: position,
    });
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const triggerStyle = !isMobile && hasOpenInternalChats
    ? { right: `${getCalculatorTriggerRight(openInternalChatsCount)}px` }
    : undefined;

  if (!isOpen) {
    // Botão flutuante global para abrir
    return (
      <button
        type="button"
        className={`global-calculator-trigger-btn animate-scale-in ${hasOpenInternalChats ? 'has-internal-chat' : ''}`}
        title="Abrir Calculadora"
        style={triggerStyle}
        onClick={toggleCalculator}
      >
        <Calculator size={22} />
      </button>
    );
  }

  const renderActiveCalculator = () => {
    switch (activeModel) {
      case 'normal':
        return <NormalCalculator />;
      case 'accounting':
        return <AccountingCalculator />;
      case 'tax':
        return <TaxCalculator />;
      default:
        return <NormalCalculator />;
    }
  };

  // Renderização Desktop (Janela Flutuante Arrastável)
  if (!isMobile) {
    return (
      <>
        <button
          type="button"
          className={`global-calculator-trigger-btn active ${hasOpenInternalChats ? 'has-internal-chat' : ''}`}
          title="Fechar Calculadora"
          style={triggerStyle}
          onClick={closeCalculator}
        >
          <Calculator size={22} />
        </button>

        <div
          ref={calculatorRef}
          className={`floating-calculator-window animate-scale-in ${hasOpenInternalChats ? 'has-internal-chat' : ''}`}
          role="dialog"
          aria-label="Calculadora contábil"
          tabIndex={-1}
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
            width: `${size.width}px`,
            height: `${size.height}px`,
            position: 'fixed',
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {/* Header */}
          <div className="calculator-header">
            <div className="header-title">
              <Move size={14} className="drag-handle-icon" />
              <span>Calculadora Contábil</span>
            </div>
            <div className="header-actions">
              <button
                type="button"
                className="header-btn close-btn"
                title="Fechar"
                onClick={closeCalculator}
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Seletor de Modelo */}
          <CalculatorSelector />

          {/* Conteúdo */}
          <div className="calculator-body">
            {renderActiveCalculator()}
          </div>

          <div
            className="calculator-resize-handle resize-right"
            onPointerDown={(event) => handleResizePointerDown(event, 'right')}
          />
          <div
            className="calculator-resize-handle resize-bottom"
            onPointerDown={(event) => handleResizePointerDown(event, 'bottom')}
          />
          <div
            className="calculator-resize-handle resize-corner"
            onPointerDown={(event) => handleResizePointerDown(event, 'corner')}
          />
        </div>
      </>
    );
  }

  // Renderização Mobile (Modal Centralizado)
  return (
    <div className="calculator-modal-backdrop" onClick={closeCalculator}>
      <div className="floating-calculator-window mobile-modal animate-slide-up" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="calculator-header">
          <div className="header-title">
            <Calculator size={16} />
            <span>Calculadora Contábil</span>
          </div>
          <div className="header-actions">
            <button
              type="button"
              className="header-btn close-btn"
              title="Fechar"
              onClick={closeCalculator}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Seletor de Modelo */}
        <CalculatorSelector />

        {/* Conteúdo */}
        <div className="calculator-body">
          {renderActiveCalculator()}
        </div>
      </div>
    </div>
  );
};
