import SwiftUI
import AVFoundation

struct RecordingView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    let onSave: ((Recording) -> Void)?

    @State private var viewModel = RecordingViewModel()
    @State private var isShowingSaveSheet = false

    init(onSave: ((Recording) -> Void)? = nil) {
        self.onSave = onSave
    }

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
                        viewModel.prepareDraftTitleIfNeeded()
                        isShowingSaveSheet = true
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
            .sheet(isPresented: $isShowingSaveSheet) {
                NavigationStack {
                    RecordingSaveSheet(
                        title: $viewModel.draftTitle,
                        suggestedTitle: viewModel.draftTitle,
                        durationText: viewModel.formattedDuration,
                        isSaving: viewModel.isSaving,
                        onQuickTitleSelected: { title in
                            viewModel.draftTitle = title
                        },
                        onCancel: {
                            isShowingSaveSheet = false
                        },
                        onSave: {
                            Task {
                                if let recording = await viewModel.save(appState: appState, title: viewModel.draftTitle) {
                                    onSave?(recording)
                                    isShowingSaveSheet = false
                                    dismiss()
                                }
                            }
                        }
                    )
                }
                .presentationDetents([.medium])
                .presentationDragIndicator(.visible)
            }
        }
    }
}

private struct RecordingSaveSheet: View {
    @Binding var title: String
    let suggestedTitle: String
    let durationText: String
    let isSaving: Bool
    let onQuickTitleSelected: (String) -> Void
    let onCancel: () -> Void
    let onSave: () -> Void
    @FocusState private var isTitleFieldFocused: Bool

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                header
                titleField
                quickLabels
            }
            .padding(.horizontal, 24)
            .padding(.top, 28)
            .padding(.bottom, 24)
            .frame(maxWidth: .infinity, alignment: .topLeading)
        }
        .background(Theme.canvas.ignoresSafeArea())
        .safeAreaInset(edge: .bottom) {
            actionBar
        }
        .scrollDismissesKeyboard(.interactively)
        .onAppear {
            isTitleFieldFocused = true
        }
    }

    private var header: some View {
        HStack(alignment: .center, spacing: 12) {
            Text("Name Recording")
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(Theme.ink)

            Spacer()

            Label(durationText, systemImage: "waveform")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.accentPressed)
                .padding(.horizontal, 10)
                .padding(.vertical, 7)
                .background(Theme.accentSoft)
                .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous))
        }
    }

    private var titleField: some View {
        VStack(alignment: .leading, spacing: 12) {
            fieldLabel("Title")

            HStack(spacing: 10) {
                TextField("Recording title", text: $title)
                    .textFieldStyle(.plain)
                    .submitLabel(.done)
                    .focused($isTitleFieldFocused)
                    .tint(Theme.accentPressed)
                    .foregroundStyle(Theme.ink)
                    .disabled(isSaving)
                    .onSubmit {
                        onSave()
                    }

                if !title.isEmpty {
                    Button {
                        title = ""
                        isTitleFieldFocused = true
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundStyle(Theme.muted.opacity(0.42))
                    }
                    .buttonStyle(.plain)
                    .disabled(isSaving)
                    .accessibilityLabel("Clear title")
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .background(Theme.paper)
            .overlay(
                RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous)
                    .stroke(
                        isTitleFieldFocused ? Theme.accentPressed.opacity(0.55) : Theme.divider,
                        lineWidth: isTitleFieldFocused ? 1.5 : 1
                    )
            )
            .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous))
        }
    }

    private var quickLabels: some View {
        VStack(alignment: .leading, spacing: 12) {
            fieldLabel("Quick labels")

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(quickTitleOptions, id: \.self) { option in
                        quickTitleChip(option)
                    }
                }
                .padding(.vertical, 2)
            }
        }
    }

    private var actionBar: some View {
        HStack(spacing: 12) {
            Button(role: .cancel) {
                onCancel()
            } label: {
                Text("Cancel")
                    .frame(maxWidth: .infinity)
            }
            .secondaryButtonStyle()
            .buttonStyle(PressableScaleStyle())
            .disabled(isSaving)
            .opacity(isSaving ? 0.55 : 1)

            Button {
                onSave()
            } label: {
                if isSaving {
                    ProgressView()
                        .tint(.white)
                        .frame(maxWidth: .infinity)
                } else {
                    Text("Save Recording")
                        .frame(maxWidth: .infinity)
                }
            }
            .primaryButtonStyle()
            .buttonStyle(PressableScaleStyle())
            .disabled(isSaving)
            .opacity(isSaving ? 0.7 : 1)
        }
        .padding(.horizontal, 24)
        .padding(.top, 12)
        .padding(.bottom, 12)
        .background(Theme.paper)
        .overlay(alignment: .top) {
            Rectangle()
                .fill(Theme.divider)
                .frame(height: 1)
        }
    }

    private func fieldLabel(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 11, weight: .semibold))
            .textCase(.uppercase)
            .tracking(1.2)
            .foregroundStyle(Theme.muted.opacity(0.7))
    }

    private func quickTitleChip(_ option: String) -> some View {
        let isSelected = option == title

        return Button {
            onQuickTitleSelected(option)
            isTitleFieldFocused = true
        } label: {
            Text(option)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(isSelected ? Theme.accentPressed : Theme.ink)
                .lineLimit(1)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(isSelected ? Theme.accentSoft : Theme.paper)
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous)
                        .stroke(isSelected ? Theme.accentPressed.opacity(0.45) : Theme.divider, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous))
        }
        .buttonStyle(PressableScaleStyle())
        .disabled(isSaving)
    }

    private var quickTitleOptions: [String] {
        let options = [
            suggestedTitle,
            "Quick idea - \(durationText)",
            "Voice memo - \(durationText)",
            "Take - \(durationText)"
        ]

        return options.reduce(into: []) { result, option in
            if !result.contains(option) {
                result.append(option)
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
