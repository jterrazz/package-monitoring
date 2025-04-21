import { type LoggerPort } from '@jterrazz/logger';

import {
    type CapitalizedString,
    type MonitoringPort,
    type SegmentName,
} from '../ports/monitoring.port.js';

/**
 * No-operation implementation of the monitoring service.
 * Used when monitoring is disabled or not configured.
 * All operations are no-ops except for optional logging.
 */
export class NoopMonitoringAdapter implements MonitoringPort {
    constructor(private readonly logger?: LoggerPort) {
        this.logger?.info('Monitoring is disabled');
    }

    public async initialize(): Promise<void> {}

    public async monitorSegment<T>(_name: SegmentName, operation: () => Promise<T>): Promise<T> {
        return operation();
    }

    public async monitorTransaction<T>(
        _domain: CapitalizedString,
        _name: CapitalizedString,
        operation: () => Promise<T>,
    ): Promise<T> {
        return operation();
    }

    public recordCount(
        _domain: CapitalizedString,
        _name: CapitalizedString,
        _value?: number,
    ): void {}

    public recordMeasurement(
        _domain: CapitalizedString,
        _name: CapitalizedString,
        _value: number,
    ): void {}
}
