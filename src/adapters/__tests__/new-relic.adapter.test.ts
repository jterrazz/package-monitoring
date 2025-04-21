import type { LoggerPort } from '@jterrazz/logger';
import { mock } from 'jest-mock-extended';
import type { TransactionHandle } from 'newrelic';

import { CapitalizedString, SegmentName } from '../../ports/monitoring.port.js';

import { NewRelicMonitoringAdapter } from '../new-relic.adapter.js';

// Create a mock NewRelic module with Jest functions
const mockNewRelic = {
    addCustomAttribute: jest.fn(),
    endTransaction: jest.fn(),
    getTransaction: jest.fn(),
    recordMetric: jest.fn(),
    startBackgroundTransaction: jest.fn(),
    startSegment: jest.fn(),
};

// Mock the newrelic module
jest.mock('newrelic', () => ({
    __esModule: true,
    default: mockNewRelic,
}));

describe('NewRelicMonitoringAdapter', () => {
    // Common test data
    const testEnvironment = 'test';
    const testLicenseKey = 'test-key';
    const testDomain = 'TestDomain' as CapitalizedString;
    const testName = 'TestName' as CapitalizedString;
    const testSegmentName = 'TestDomain/TestSection/TestAction' as SegmentName;

    // Reused objects
    let adapter: NewRelicMonitoringAdapter;
    let logger: LoggerPort;

    beforeEach(() => {
        jest.clearAllMocks();
        logger = mock<LoggerPort>();
    });

    describe('initialization', () => {
        it('should initialize with a license key', async () => {
            // Given
            adapter = new NewRelicMonitoringAdapter({
                environment: testEnvironment,
                licenseKey: testLicenseKey,
                logger,
            });

            // When
            await adapter.initialize();

            // Then
            expect(mockNewRelic.addCustomAttribute).toHaveBeenCalledWith(
                'environment',
                testEnvironment,
            );
            expect(logger.info).toHaveBeenCalledWith('Monitoring initialized successfully');
        });

        it('should warn and disable monitoring when license key is missing', async () => {
            // Given
            adapter = new NewRelicMonitoringAdapter({
                environment: testEnvironment,
                logger,
            });

            // When
            await adapter.initialize();

            // Then
            expect(logger.warn).toHaveBeenCalledWith(
                'Monitoring license key is not set, monitoring will not be enabled',
            );
            expect(mockNewRelic.addCustomAttribute).not.toHaveBeenCalled();
        });

        it('should handle initialization errors', async () => {
            // Given
            adapter = new NewRelicMonitoringAdapter({
                environment: testEnvironment,
                licenseKey: testLicenseKey,
                logger,
            });

            mockNewRelic.addCustomAttribute.mockImplementationOnce(() => {
                throw new Error('Initialization error');
            });

            // When
            await adapter.initialize();

            // Then
            expect(logger.error).toHaveBeenCalledWith('Failed to initialize monitoring', {
                error: expect.any(Error),
            });
        });
    });

    describe('segment monitoring', () => {
        const operation = jest.fn().mockResolvedValue('result');

        beforeEach(async () => {
            mockNewRelic.startSegment.mockImplementation((_, __, op) => op());

            adapter = new NewRelicMonitoringAdapter({
                environment: testEnvironment,
                licenseKey: testLicenseKey,
                logger,
            });
            await adapter.initialize();
        });

        it('should monitor an operation within a segment', async () => {
            // Given
            mockNewRelic.getTransaction.mockReturnValue(mock<TransactionHandle>());

            // When
            const result = await adapter.monitorSegment(testSegmentName, operation);

            // Then
            expect(result).toBe('result');
            expect(mockNewRelic.startSegment).toHaveBeenCalledWith(
                testSegmentName,
                true,
                operation,
            );
            expect(logger.debug).toHaveBeenCalledWith('Monitored sub-operation', {
                duration: expect.any(Number),
                name: testSegmentName,
            });
        });

        it('should log errors when parent transaction is missing', async () => {
            // Given
            mockNewRelic.getTransaction.mockReturnValue(null as unknown as TransactionHandle);

            // When
            await adapter.monitorSegment(testSegmentName, operation);

            // Then
            expect(logger.error).toHaveBeenCalledWith(
                'No parent operation found while monitoring sub-operation',
                { name: testSegmentName },
            );
        });

        it('should execute operations without monitoring when agent is not initialized', async () => {
            // Given
            adapter = new NewRelicMonitoringAdapter({
                environment: testEnvironment,
                logger,
            });
            await adapter.initialize();

            // When
            const result = await adapter.monitorSegment(testSegmentName, operation);

            // Then
            expect(result).toBe('result');
            expect(mockNewRelic.startSegment).not.toHaveBeenCalled();
        });

        it('should propagate errors from monitored operations', async () => {
            // Given
            const error = new Error('Operation failed');
            const failingOperation = jest.fn().mockRejectedValue(error);
            mockNewRelic.getTransaction.mockReturnValue(mock<TransactionHandle>());

            // When/Then
            await expect(adapter.monitorSegment(testSegmentName, failingOperation)).rejects.toThrow(
                error,
            );

            // Still logs duration even on error
            expect(logger.debug).toHaveBeenCalledWith('Monitored sub-operation', {
                duration: expect.any(Number),
                name: testSegmentName,
            });
        });
    });

    describe('transaction monitoring', () => {
        const operation = jest.fn().mockResolvedValue('result');

        beforeEach(async () => {
            mockNewRelic.startBackgroundTransaction.mockImplementation(async (_, __, fn) => {
                await fn();
            });

            adapter = new NewRelicMonitoringAdapter({
                environment: testEnvironment,
                licenseKey: testLicenseKey,
                logger,
            });
            await adapter.initialize();
        });

        it('should monitor business transactions', async () => {
            // When
            const result = await adapter.monitorTransaction(testDomain, testName, operation);

            // Then
            expect(result).toBe('result');
            expect(mockNewRelic.startBackgroundTransaction).toHaveBeenCalledWith(
                testName,
                testDomain,
                expect.any(Function),
            );
            expect(mockNewRelic.endTransaction).toHaveBeenCalled();
            expect(logger.debug).toHaveBeenCalledWith('Started operation monitoring', {
                domain: testDomain,
                name: testName,
            });
        });

        it('should properly end transactions and propagate errors', async () => {
            // Given
            const error = new Error('Operation failed');
            const failingOperation = jest.fn().mockRejectedValue(error);

            // When/Then
            await expect(
                adapter.monitorTransaction(testDomain, testName, failingOperation),
            ).rejects.toThrow(error);

            // Ensures transaction is properly ended even on error
            expect(mockNewRelic.endTransaction).toHaveBeenCalled();
            expect(logger.debug).toHaveBeenCalledWith('Ended operation monitoring', {
                domain: testDomain,
                name: testName,
            });
        });

        it('should execute operations without monitoring when agent is not initialized', async () => {
            // Given
            adapter = new NewRelicMonitoringAdapter({
                environment: testEnvironment,
                logger,
            });
            await adapter.initialize();

            // When
            const result = await adapter.monitorTransaction(testDomain, testName, operation);

            // Then
            expect(result).toBe('result');
            expect(mockNewRelic.startBackgroundTransaction).not.toHaveBeenCalled();
            expect(mockNewRelic.endTransaction).not.toHaveBeenCalled();
        });
    });

    describe('metric recording', () => {
        beforeEach(async () => {
            adapter = new NewRelicMonitoringAdapter({
                environment: testEnvironment,
                licenseKey: testLicenseKey,
                logger,
            });
            await adapter.initialize();
        });

        it('should record count metrics with default and custom values', async () => {
            // When - default value
            adapter.recordCount(testDomain, testName);

            // Then
            expect(mockNewRelic.recordMetric).toHaveBeenCalledWith(`${testDomain}/${testName}`, 1);
            expect(logger.debug).toHaveBeenCalledWith('Recorded count metric', {
                domain: testDomain,
                name: testName,
                value: 1,
            });

            // Reset mocks
            jest.clearAllMocks();

            // When - custom value
            adapter.recordCount(testDomain, testName, 5);

            // Then
            expect(mockNewRelic.recordMetric).toHaveBeenCalledWith(`${testDomain}/${testName}`, 5);
        });

        it('should record measurement metrics', async () => {
            // Given
            const value = 123.45;

            // When
            adapter.recordMeasurement(testDomain, testName, value);

            // Then
            expect(mockNewRelic.recordMetric).toHaveBeenCalledWith(
                `${testDomain}/${testName}`,
                value,
            );
            expect(logger.debug).toHaveBeenCalledWith('Recorded measurement', {
                domain: testDomain,
                name: testName,
                value,
            });
        });

        it('should skip recording metrics when agent is not initialized', async () => {
            // Given
            adapter = new NewRelicMonitoringAdapter({
                environment: testEnvironment,
                logger,
            });
            await adapter.initialize();

            // When
            adapter.recordCount(testDomain, testName);
            adapter.recordMeasurement(testDomain, testName, 100);

            // Then
            expect(mockNewRelic.recordMetric).not.toHaveBeenCalled();
            expect(logger.debug).not.toHaveBeenCalled();
        });
    });
});
