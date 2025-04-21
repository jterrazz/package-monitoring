import type { LoggerPort } from '@jterrazz/logger';
import { mock, MockProxy } from 'jest-mock-extended';
import type { TransactionHandle } from 'newrelic';

import { CapitalizedString, SegmentName } from '../../ports/monitoring.port.js';

import { NewRelicMonitoringAdapter } from '../new-relic.adapter.js';

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
    let adapter: NewRelicMonitoringAdapter;
    let mockLogger: MockProxy<LoggerPort>;
    const testEnvironment = 'test';
    const testLicenseKey = 'test-key';
    const testDomain: CapitalizedString = 'TestDomain';
    const testName: CapitalizedString = 'TestName';
    const testSegmentName: SegmentName = 'TestDomain/TestSection/TestAction';

    beforeEach(() => {
        // Reset all mocks before each test
        jest.clearAllMocks();
        mockLogger = mock<LoggerPort>();
    });

    describe('initialize', () => {
        it('should initialize the agent, add custom attributes, and log success when a license key is provided', async () => {
            // Given
            adapter = new NewRelicMonitoringAdapter({
                environment: testEnvironment,
                licenseKey: testLicenseKey,
                logger: mockLogger,
            });

            // When
            await adapter.initialize();

            // Then
            expect(mockNewRelic.addCustomAttribute).toHaveBeenCalledWith(
                'environment',
                testEnvironment,
            );
            expect(mockLogger.info).toHaveBeenCalledWith('Monitoring initialized successfully');
            expect(mockLogger.warn).not.toHaveBeenCalled();
            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        it('should log a warning and not initialize the agent when no license key is provided', async () => {
            // Given
            adapter = new NewRelicMonitoringAdapter({
                environment: testEnvironment,
                logger: mockLogger,
                // No license key
            });

            // When
            await adapter.initialize();

            // Then
            expect(mockLogger.warn).toHaveBeenCalledWith(
                'Monitoring license key is not set, monitoring will not be enabled',
            );
            expect(mockNewRelic.addCustomAttribute).not.toHaveBeenCalled();
            expect(mockLogger.info).not.toHaveBeenCalled();
            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        it('should log an error if initializing the agent fails', async () => {
            // Given
            adapter = new NewRelicMonitoringAdapter({
                environment: testEnvironment,
                licenseKey: testLicenseKey,
                logger: mockLogger,
            });

            // Simulate an error during initialization
            const importError = new Error('Failed to import');
            mockNewRelic.addCustomAttribute.mockImplementationOnce(() => {
                throw importError;
            });

            // When
            await adapter.initialize();

            // Then
            expect(mockLogger.error).toHaveBeenCalledWith('Failed to initialize monitoring', {
                error: expect.any(Error),
            });
            expect(mockLogger.info).not.toHaveBeenCalled();
        });
    });

    describe('monitorSegment', () => {
        const operation = jest.fn().mockResolvedValue('result');

        beforeEach(async () => {
            adapter = new NewRelicMonitoringAdapter({
                environment: testEnvironment,
                licenseKey: testLicenseKey,
                logger: mockLogger,
            });
            await adapter.initialize();
            // Setup default implementations
            mockNewRelic.startSegment.mockImplementation(async (_, __, op) => op());
        });

        it('should start a segment, execute the operation, and return the result when the agent is initialized', async () => {
            // Given
            const mockTransaction = mock<TransactionHandle>();
            mockNewRelic.getTransaction.mockReturnValue(mockTransaction);

            // When
            const result = await adapter.monitorSegment(testSegmentName, operation);

            // Then
            expect(mockNewRelic.getTransaction).toHaveBeenCalledTimes(1);
            expect(mockNewRelic.startSegment).toHaveBeenCalledWith(
                testSegmentName,
                true,
                operation,
            );
            expect(operation).toHaveBeenCalledTimes(1);
            expect(result).toBe('result');
            expect(mockLogger.error).not.toHaveBeenCalled();
            expect(mockLogger.debug).toHaveBeenCalledWith('Monitored sub-operation', {
                duration: expect.any(Number),
                name: testSegmentName,
            });
        });

        it('should log an error if no parent transaction is found but still execute the segment', async () => {
            // Given
            mockNewRelic.getTransaction.mockReturnValue(null as unknown as TransactionHandle);

            // When
            const result = await adapter.monitorSegment(testSegmentName, operation);

            // Then
            expect(mockLogger.error).toHaveBeenCalledWith(
                'No parent operation found while monitoring sub-operation',
                { name: testSegmentName },
            );
            expect(mockNewRelic.startSegment).toHaveBeenCalledWith(
                testSegmentName,
                true,
                operation,
            );
            expect(operation).toHaveBeenCalledTimes(1);
            expect(result).toBe('result');
            expect(mockLogger.debug).toHaveBeenCalledWith('Monitored sub-operation', {
                duration: expect.any(Number),
                name: testSegmentName,
            });
        });

        it('should only execute the operation if the agent is not initialized', async () => {
            // Given
            adapter = new NewRelicMonitoringAdapter({
                environment: testEnvironment,
                // No license key -> agent not initialized
                logger: mockLogger,
            });
            await adapter.initialize(); // Call initialize to set agent to null

            // When
            const result = await adapter.monitorSegment(testSegmentName, operation);

            // Then
            expect(mockNewRelic.getTransaction).not.toHaveBeenCalled();
            expect(mockNewRelic.startSegment).not.toHaveBeenCalled();
            expect(operation).toHaveBeenCalledTimes(1);
            expect(result).toBe('result');
            expect(mockLogger.debug).not.toHaveBeenCalled(); // No monitoring logs
        });

        it('should execute the segment and log duration even if the operation fails', async () => {
            // Given
            const error = new Error('Operation failed');
            const failingOperation = jest.fn().mockRejectedValue(error);
            const mockTransaction = mock<TransactionHandle>();
            mockNewRelic.getTransaction.mockReturnValue(mockTransaction);

            // When / Then
            await expect(adapter.monitorSegment(testSegmentName, failingOperation)).rejects.toThrow(
                error,
            );
            expect(mockNewRelic.startSegment).toHaveBeenCalledWith(
                testSegmentName,
                true,
                failingOperation,
            );
            expect(failingOperation).toHaveBeenCalledTimes(1);
            expect(mockLogger.debug).toHaveBeenCalledWith('Monitored sub-operation', {
                duration: expect.any(Number),
                name: testSegmentName,
            });
        });
    });

    describe('monitorTransaction', () => {
        const operation = jest.fn().mockResolvedValue('result');

        beforeEach(async () => {
            adapter = new NewRelicMonitoringAdapter({
                environment: testEnvironment,
                licenseKey: testLicenseKey,
                logger: mockLogger,
            });
            await adapter.initialize();

            // Setup mock implementation for startBackgroundTransaction
            mockNewRelic.startBackgroundTransaction.mockImplementation(async (name, group, fn) => {
                await fn(); // Execute the wrapped operation
            });
        });

        it('should start a background transaction, execute the operation, end the transaction, and return the result', async () => {
            // Given - adapter initialized in beforeEach

            // When
            const result = await adapter.monitorTransaction(testDomain, testName, operation);

            // Then
            expect(mockNewRelic.startBackgroundTransaction).toHaveBeenCalledWith(
                testName,
                testDomain,
                expect.any(Function),
            );
            expect(operation).toHaveBeenCalledTimes(1);
            expect(mockNewRelic.endTransaction).toHaveBeenCalledTimes(1);
            expect(result).toBe('result');
            expect(mockLogger.debug).toHaveBeenCalledWith('Started operation monitoring', {
                domain: testDomain,
                name: testName,
            });
            expect(mockLogger.debug).toHaveBeenCalledWith('Ended operation monitoring', {
                domain: testDomain,
                name: testName,
            });
        });

        it('should end the transaction and reject if the operation throws an error', async () => {
            // Given
            const error = new Error('Operation failed');
            const failingOperation = jest.fn().mockRejectedValue(error);

            // This rejects because the wrapped fn will throw
            mockNewRelic.startBackgroundTransaction.mockImplementation(async (name, group, fn) => {
                await fn(); // This will throw because failingOperation throws
            });

            // When / Then
            await expect(
                adapter.monitorTransaction(testDomain, testName, failingOperation),
            ).rejects.toThrow(error);
            expect(mockNewRelic.startBackgroundTransaction).toHaveBeenCalledWith(
                testName,
                testDomain,
                expect.any(Function),
            );
            expect(failingOperation).toHaveBeenCalledTimes(1);
            expect(mockNewRelic.endTransaction).toHaveBeenCalledTimes(1); // Ensure transaction is ended even on error
            expect(mockLogger.debug).toHaveBeenCalledWith('Started operation monitoring', {
                domain: testDomain,
                name: testName,
            });
            expect(mockLogger.debug).toHaveBeenCalledWith('Ended operation monitoring', {
                domain: testDomain,
                name: testName,
            });
        });

        it('should only execute the operation if the agent is not initialized', async () => {
            // Given
            adapter = new NewRelicMonitoringAdapter({
                environment: testEnvironment,
                // No license key
                logger: mockLogger,
            });
            await adapter.initialize(); // Ensure agent is null

            // When
            const result = await adapter.monitorTransaction(testDomain, testName, operation);

            // Then
            expect(mockNewRelic.startBackgroundTransaction).not.toHaveBeenCalled();
            expect(operation).toHaveBeenCalledTimes(1);
            expect(mockNewRelic.endTransaction).not.toHaveBeenCalled();
            expect(result).toBe('result');
            expect(mockLogger.debug).not.toHaveBeenCalledWith(
                expect.stringContaining('operation monitoring'),
                expect.anything(),
            );
        });
    });

    describe('recordCount', () => {
        beforeEach(async () => {
            adapter = new NewRelicMonitoringAdapter({
                environment: testEnvironment,
                licenseKey: testLicenseKey,
                logger: mockLogger,
            });
            await adapter.initialize();
        });

        it('should record a metric with the correct name and default value 1', () => {
            // Given - initialized adapter

            // When
            adapter.recordCount(testDomain, testName);

            // Then
            expect(mockNewRelic.recordMetric).toHaveBeenCalledWith(`${testDomain}/${testName}`, 1);
            expect(mockLogger.debug).toHaveBeenCalledWith('Recorded count metric', {
                domain: testDomain,
                name: testName,
                value: 1,
            });
        });

        it('should record a metric with the correct name and specified value', () => {
            // Given
            const value = 5;

            // When
            adapter.recordCount(testDomain, testName, value);

            // Then
            expect(mockNewRelic.recordMetric).toHaveBeenCalledWith(
                `${testDomain}/${testName}`,
                value,
            );
            expect(mockLogger.debug).toHaveBeenCalledWith('Recorded count metric', {
                domain: testDomain,
                name: testName,
                value,
            });
        });

        it('should not record a metric if the agent is not initialized', async () => {
            // Given
            adapter = new NewRelicMonitoringAdapter({
                environment: testEnvironment,
                // No license key
                logger: mockLogger,
            });
            await adapter.initialize(); // Ensure agent is null

            // When
            adapter.recordCount(testDomain, testName);

            // Then
            expect(mockNewRelic.recordMetric).not.toHaveBeenCalled();
            expect(mockLogger.debug).not.toHaveBeenCalled();
        });
    });

    describe('recordMeasurement', () => {
        beforeEach(async () => {
            adapter = new NewRelicMonitoringAdapter({
                environment: testEnvironment,
                licenseKey: testLicenseKey,
                logger: mockLogger,
            });
            await adapter.initialize();
        });
        const value = 123.45;

        it('should record a metric with the correct name and value', () => {
            // Given - initialized adapter

            // When
            adapter.recordMeasurement(testDomain, testName, value);

            // Then
            expect(mockNewRelic.recordMetric).toHaveBeenCalledWith(
                `${testDomain}/${testName}`,
                value,
            );
            expect(mockLogger.debug).toHaveBeenCalledWith('Recorded measurement', {
                domain: testDomain,
                name: testName,
                value,
            });
        });

        it('should not record a metric if the agent is not initialized', async () => {
            // Given
            adapter = new NewRelicMonitoringAdapter({
                environment: testEnvironment,
                // No license key
                logger: mockLogger,
            });
            await adapter.initialize(); // Ensure agent is null

            // When
            adapter.recordMeasurement(testDomain, testName, value);

            // Then
            expect(mockNewRelic.recordMetric).not.toHaveBeenCalled();
            expect(mockLogger.debug).not.toHaveBeenCalled();
        });
    });
});
