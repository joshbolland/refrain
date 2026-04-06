import SwiftUI
import AVFoundation

struct RecordingView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    @State private var viewModel = RecordingViewModel()

    var body: some View {
        NavigationStack {
            VStack(spacing: 32) {
                Spacer()

                // Waveform visualization
                WaveformView(levels: viewModel.audioLevels)
                    .frame(height: 120)
                    .padding(.horizontal)

                // Duration timer
                Text(viewModel.formattedDuration)
                    .font(.system(size: 48, weight: .light, design: .monospaced))
                    .foregroundStyle(viewModel.isRecording ? .primary : .secondary)

                Spacer()

                // Controls
                HStack(spacing: 48) {
                    // Discard button
                    Button {
                        viewModel.discard()
                    } label: {
                        Image(systemName: "trash")
                            .font(.title2)
                            .foregroundStyle(.red)
                            .frame(width: 60, height: 60)
                            .background(Color.red.opacity(0.1))
                            .clipShape(Circle())
                    }
                    .disabled(!viewModel.hasRecording || viewModel.isSaving)
                    .opacity(viewModel.hasRecording && !viewModel.isSaving ? 1 : 0.3)

                    // Record/Pause button
                    Button {
                        if viewModel.isRecording {
                            viewModel.pause()
                        } else if viewModel.hasRecording {
                            viewModel.resume()
                        } else {
                            Task { await viewModel.startRecording() }
                        }
                    } label: {
                        ZStack {
                            Circle()
                                .fill(viewModel.isRecording ? Color.red : Theme.primaryColor)
                                .frame(width: 80, height: 80)

                            if viewModel.isRecording {
                                RoundedRectangle(cornerRadius: 4)
                                    .fill(.white)
                                    .frame(width: 24, height: 24)
                            } else if viewModel.hasRecording {
                                Image(systemName: "play.fill")
                                    .font(.title)
                                    .foregroundStyle(.white)
                            } else {
                                Circle()
                                    .fill(.white)
                                    .frame(width: 32, height: 32)
                            }
                        }
                    }
                    .disabled(viewModel.isSaving)
                    .opacity(viewModel.isSaving ? 0.5 : 1)

                    // Save button
                    Button {
                        Task {
                            if await viewModel.save(appState: appState) != nil {
                                dismiss()
                            }
                        }
                    } label: {
                        ZStack {
                            Circle()
                                .fill(Color.green.opacity(0.1))
                                .frame(width: 60, height: 60)

                            if viewModel.isSaving {
                                ProgressView()
                                    .tint(.green)
                            } else {
                                Image(systemName: "checkmark")
                                    .font(.title2)
                                    .foregroundStyle(.green)
                            }
                        }
                    }
                    .disabled(!viewModel.hasRecording || viewModel.isRecording || viewModel.isSaving)
                    .opacity(viewModel.hasRecording && !viewModel.isRecording && !viewModel.isSaving ? 1 : 0.3)
                }

                // Status text
                VStack(spacing: 8) {
                    Text(viewModel.statusText)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)

                    if let saveErrorMessage = viewModel.saveErrorMessage {
                        Text(saveErrorMessage)
                            .font(.footnote)
                            .foregroundStyle(.red)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 24)
                    }
                }
                .padding(.bottom, 32)
            }
            .navigationTitle("Record")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") {
                        viewModel.discard()
                        dismiss()
                    }
                }
            }
            .task {
                await viewModel.requestPermission()
            }
            .alert("Microphone Access", isPresented: $viewModel.showPermissionAlert) {
                Button("Settings") {
                    if let url = URL(string: UIApplication.openSettingsURLString) {
                        UIApplication.shared.open(url)
                    }
                }
                Button("Cancel", role: .cancel) {
                    dismiss()
                }
            } message: {
                Text("Please enable microphone access in Settings to record audio.")
            }
        }
    }
}

// MARK: - Waveform View

struct WaveformView: View {
    let levels: [Float]

    private let barCount = 48
    private let barSpacing: CGFloat = 2

    var body: some View {
        GeometryReader { geometry in
            HStack(spacing: barSpacing) {
                ForEach(0..<barCount, id: \.self) { index in
                    let level = index < levels.count ? levels[index] : 0
                    let height = max(4, CGFloat(level) * geometry.size.height)

                    RoundedRectangle(cornerRadius: 2)
                        .fill(Theme.primaryColor)
                        .frame(height: height)
                }
            }
            .frame(maxHeight: .infinity, alignment: .center)
        }
    }
}

#Preview("Recording") {
    RecordingView()
        .environment(AppState.preview())
        .environment(\.isPreview, true)
}
