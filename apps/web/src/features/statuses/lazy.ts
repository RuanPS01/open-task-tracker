// Gerenciar status (lista e diálogo) é raro: vem num pedaço separado do build, baixado
// quando a seção ou o diálogo abre, para não pesar a abertura do app.
import { lazy } from 'react';

export const StatusList = lazy(() => import('./StatusList').then((module) => ({ default: module.StatusList })));
