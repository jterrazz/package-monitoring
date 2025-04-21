export type CapitalizedString = `${Capitalize<string>}`;

/**
 * Port for application monitoring and observability.
 * Provides capabilities for tracking metrics, transactions, and performance segments.
 */
export interface MonitoringPort {
    /**
     * Initialize the monitoring service with required configuration
     */
    initialize(): Promise<void>;

    /**
     * Monitor a segment within a transaction
     * @param name - The name of the segment
     * @param operation - The operation to monitor
     */
    monitorSegment<T>(name: SegmentName, operation: () => Promise<T>): Promise<T>;

    /**
     * Monitor a business transaction with automatic error handling and timing
     * @param domain - The domain of the transaction
     * @param name - The transaction path in format "SubDomain/Action"
     * @param operation - The operation to monitor
     */
    monitorTransaction<T>(
        domain: CapitalizedString,
        name: CapitalizedString,
        operation: () => Promise<T>,
    ): Promise<T>;

    /**
     * Record a counter metric with an optional value
     * @param domain - The domain of the metric
     * @param name - The name of the metric to increment in format "SubDomain/Action"
     * @param value - The value to increment by (defaults to 1)
     */
    recordCount(domain: CapitalizedString, name: CapitalizedString, value?: number): void;

    /**
     * Record a measurement metric with a specific value
     * @param domain - The domain of the metric
     * @param name - The name of the metric in format "SubDomain/Action"
     * @param value - The value to record
     */
    recordMeasurement(domain: CapitalizedString, name: CapitalizedString, value: number): void;
}

export type SegmentName = `${CapitalizedString}/${CapitalizedString}/${CapitalizedString}`;
