
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Icons } from './constants';
import { FlowStep, Message, PrescriptionData, TestItem, Address, Provider } from './types';
import { Button } from './components/Button';
import { TestList } from './components/TestList';
import { processPrescription } from './services/geminiService';

const SAVED_ADDRESSES: Address[] = [
  { id: '1', label: 'Home', details: 'H-12, Green Park Main, Delhi 110016' },
  { id: '2', label: 'Office', details: 'Plot 4, DLF Cyber City, Gurgaon 122002' }
];

const LAB_PROVIDERS: Provider[] = [
  { id: 'p1', name: 'HealthSaathi Premium Labs', rating: 4.9, deliveryFee: 0, optionalTestPrice: 499 },
  { id: 'p2', name: 'Apollo Diagnostics', rating: 4.7, deliveryFee: 50, optionalTestPrice: 599 },
  { id: 'p3', name: 'Thyrocare', rating: 4.5, deliveryFee: 0, optionalTestPrice: 399 }
];

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [flowStep, setFlowStep] = useState<FlowStep>(FlowStep.WELCOME);
  const [isTyping, setIsTyping] = useState(false);
  const [prescriptionData, setPrescriptionData] = useState<PrescriptionData | null>(null);
  const [cart, setCart] = useState<TestItem[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<Provider>(LAB_PROVIDERS[0]);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initializedRef = useRef(false);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const addMessage = useCallback((msg: Omit<Message, 'id'>) => {
    setMessages(prev => [...prev, { ...msg, id: Math.random().toString(36).substr(2, 9) }]);
  }, []);

  const simulateTyping = async (seconds: number = 1) => {
    setIsTyping(true);
    await new Promise(resolve => setTimeout(resolve, seconds * 1000));
    setIsTyping(false);
  };

  const startFlow = useCallback(async () => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    
    await simulateTyping(1.2);
    addMessage({
      role: 'assistant',
      content: 'Welcome to HealthSaathi 👋\nHow can I help you today?',
      type: 'options',
      options: ['Book Lab Tests', 'Customer Support', 'Booking / Order Queries']
    });
  }, [addMessage]);

  useEffect(() => {
    startFlow();
  }, [startFlow]);

  // synchronization effect: move to next step only when both Rx data and Address are ready
  useEffect(() => {
    if (flowStep === FlowStep.PROCESSING && prescriptionData && selectedAddress) {
      completePrescriptionProcessing(prescriptionData);
    }
  }, [prescriptionData, selectedAddress, flowStep]);

  const handleOptionClick = async (option: string) => {
    addMessage({ role: 'user', content: option });

    if (option === 'Book Lab Tests') {
      setFlowStep(FlowStep.AWAITING_PRESCRIPTION);
      await simulateTyping(0.8);
      addMessage({
        role: 'assistant',
        content: 'Please upload a clear photo or PDF of your doctor’s prescription so I can read and process it for you.'
      });
    } else {
      await simulateTyping(0.5);
      addMessage({
        role: 'assistant',
        content: `You selected "${option}". I'll connect you with an agent to assist further.`,
        type: 'status',
        data: { status: 'Connecting to agent...' }
      });
      setFlowStep(FlowStep.AGENT_FALLBACK);
    }
  };

  const completePrescriptionProcessing = async (data: PrescriptionData) => {
    if (!data.prescription_valid) {
      addMessage({
        role: 'assistant',
        content: `❌ This prescription is invalid and cannot be processed\n\nReason(s):\n${data.validation_issues.map(issue => `• ${issue}`).join('\n')}`,
        type: 'options',
        options: ['Upload a new prescription', 'Connect to a customer support agent']
      });
      setFlowStep(FlowStep.VALIDATION_FEEDBACK);
    } else {
      addMessage({
        role: 'assistant',
        content: '✅ Prescription verified successfully\nI’ve now extracted the lab tests mentioned by your doctor.',
      });
      await simulateTyping(1.5);
      setCart(data.tests_extracted);
      addMessage({
        role: 'assistant',
        content: 'I found the following member details and tests from your prescription:',
        type: 'prescription_review',
        data: data
      });
      setFlowStep(FlowStep.REVIEW_TESTS);
    }
  };

  const handleAddressSelect = async (address: Address) => {
    setSelectedAddress(address);
    addMessage({ role: 'user', content: `Collect from: ${address.label}` });
    
    if (!prescriptionData) {
      await simulateTyping(1);
      addMessage({
        role: 'assistant',
        content: 'Got your address. Still reviewing your prescription... almost there.',
        type: 'status',
        data: { status: 'Finalizing extraction...' }
      });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    addMessage({ role: 'user', content: `Uploaded: ${file.name}` });
    
    await simulateTyping(0.5);
    addMessage({
      role: 'assistant',
      content: 'Your prescription has been submitted and is now under review by our AI for processing. Please wait a moment...',
    });

    setFlowStep(FlowStep.PROCESSING);
    setPrescriptionData(null); // Reset for new upload

    // Prompt for address while processing
    await simulateTyping(0.5);
    addMessage({
      role: 'assistant',
      content: 'While I review your prescription, please select the sample collection address:',
      type: 'address_picker',
      data: SAVED_ADDRESSES
    });

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      try {
        const data = await processPrescription(base64);
        setPrescriptionData(data);
      } catch (error) {
        console.error(error);
        addMessage({
          role: 'assistant',
          content: "I had trouble reading the prescription. Would you like to try again or talk to an agent?",
          type: 'options',
          options: ['Try Again', 'Connect to Agent']
        });
        setFlowStep(FlowStep.AGENT_FALLBACK);
      }
    };
    reader.readAsDataURL(file);
  };

  const removeFromCart = (index: number, isExtracted: boolean) => {
    if (isExtracted) {
      setCart(prev => prev.filter((_, i) => i !== index));
    } else {
      setPrescriptionData(prev => prev ? ({
        ...prev,
        optional_tests: prev.optional_tests.filter((_, i) => i !== index)
      }) : null);
    }
  };

  const addFromOptional = (index: number) => {
    const testToAdd = prescriptionData?.optional_tests[index];
    if (testToAdd) {
      const updatedTest: TestItem = { ...testToAdd, source: 'recommended' };
      setCart(prev => [...prev, updatedTest]);
      setPrescriptionData(prev => prev ? ({
        ...prev,
        optional_tests: prev.optional_tests.filter((_, i) => i !== index)
      }) : null);
    }
  };

  const handleProviderChange = async (provider: Provider) => {
    setSelectedProvider(provider);
    addMessage({ role: 'user', content: `Switched to: ${provider.name}` });
    
    await simulateTyping(0.8);
    
    addMessage({
      role: 'assistant',
      content: `I've updated your booking with ${provider.name}. Here is the updated test summary with their pricing:`,
      type: 'prescription_review',
      data: prescriptionData
    });
  };

  const finalizeBooking = async () => {
    setFlowStep(FlowStep.FINAL_REVIEW);
    await simulateTyping(1);
    addMessage({
      role: 'assistant',
      content: 'Here’s your final test cart. Please review and proceed to confirm your booking.',
      type: 'cart',
      data: [...cart]
    });
  };

  const handlePayment = async () => {
    setFlowStep(FlowStep.PAYMENT);
    await simulateTyping(2);
    addMessage({
      role: 'assistant',
      content: '🎉 Your lab test booking is confirmed!\nYou’ll receive appointment details shortly.'
    });
    setFlowStep(FlowStep.CONFIRMED);
  };

  const handleAgentFallback = async () => {
    addMessage({
      role: 'assistant',
      content: 'I can connect you to a lab booking agent who will manually review and book your tests.',
      type: 'options',
      options: ['Assign to agent']
    });
  };

  const totalDue = cart.reduce((acc, item) => acc + (item.source === 'recommended' ? selectedProvider.optionalTestPrice : 0), 0) + selectedProvider.deliveryFee;
  const coveredCount = cart.filter(item => item.source === 'prescription').length;

  return (
    <div className="max-w-md mx-auto h-screen bg-white flex flex-col shadow-2xl relative overflow-hidden md:my-4 md:rounded-2xl md:h-[90vh]">
      {/* Header */}
      <header className="p-4 border-b border-gray-100 bg-white sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg">
            <Icons.Lab />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-none">HealthSaathi</h1>
            <p className="text-[10px] text-green-500 font-semibold uppercase tracking-wider flex items-center gap-1 mt-1">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              AI Assistant Online
            </p>
          </div>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth bg-[#FBFBFF]">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-slideInUp`}>
            <div className={`max-w-[90%] ${msg.role === 'user' ? '' : 'flex gap-2'}`}>
              {msg.role === 'assistant' && (
                <div className="w-6 h-6 rounded-full bg-blue-100 flex-shrink-0 flex items-center justify-center text-blue-600">
                  <Icons.Lab />
                </div>
              )}
              
              <div className="space-y-3 w-full">
                {msg.content && (
                  <div className={`p-3.5 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white rounded-tr-none shadow-md' 
                      : 'bg-white text-gray-800 rounded-tl-none border border-gray-100 shadow-sm'
                  }`}>
                    {msg.content.split('\n').map((line, i) => (
                      <p key={i} className={i > 0 ? 'mt-1' : ''}>{line}</p>
                    ))}
                  </div>
                )}

                {msg.type === 'options' && (
                  <div className="flex flex-wrap gap-2">
                    {msg.options?.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => {
                          if (opt === 'Upload a new prescription' || opt === 'Try Again') {
                            setFlowStep(FlowStep.AWAITING_PRESCRIPTION);
                            fileInputRef.current?.click();
                          } else if (opt === 'Connect to Agent' || opt === 'Connect to a customer support agent' || opt === 'Assign to agent') {
                            handleAgentFallback();
                          } else {
                            handleOptionClick(opt);
                          }
                        }}
                        className="px-4 py-2 rounded-full border border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100 text-sm font-medium transition-all"
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}

                {msg.type === 'address_picker' && (
                  <div className="grid grid-cols-1 gap-2">
                    {msg.data.map((addr: Address) => (
                      <button
                        key={addr.id}
                        onClick={() => handleAddressSelect(addr)}
                        className={`p-3 bg-white border rounded-xl text-left transition-all hover:bg-blue-50 group ${selectedAddress?.id === addr.id ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-200'}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-bold text-sm text-gray-900">{addr.label}</div>
                          {selectedAddress?.id === addr.id && <div className="text-blue-600"><Icons.Check /></div>}
                        </div>
                        <div className="text-[11px] text-gray-500">{addr.details}</div>
                      </button>
                    ))}
                    <button className="p-3 bg-gray-50 border border-gray-200 border-dashed rounded-xl text-xs font-bold text-gray-400 text-center hover:bg-gray-100 transition-colors">
                      + Add New Address
                    </button>
                  </div>
                )}

                {msg.type === 'prescription_review' && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-lg p-4 w-full">
                    <TestList 
                      tests={cart}
                      optionalTests={prescriptionData?.optional_tests || []}
                      onRemove={removeFromCart}
                      onAddFromOptional={addFromOptional}
                      patientDetails={prescriptionData?.patient_details}
                      doctorDetails={prescriptionData?.doctor_details}
                      diagnosis={prescriptionData?.diagnosis}
                      recommendedPrice={selectedProvider.optionalTestPrice}
                    />

                    <div className="mt-6 pt-4 border-t border-gray-100">
                      <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Partner Lab Provider</h4>
                      <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-xl mb-2">
                        <div className="flex-1">
                          <div className="text-sm font-bold text-blue-800">{selectedProvider.name}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] bg-yellow-400 text-white px-1 rounded font-bold">★ {selectedProvider.rating}</span>
                            <span className="text-[10px] text-blue-600 font-medium">Best Value Provider</span>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-blue-600 text-xs font-bold"
                          onClick={() => {
                            addMessage({
                              role: 'assistant',
                              content: 'Choose your preferred lab partner:',
                              type: 'provider_picker',
                              data: LAB_PROVIDERS
                            });
                          }}
                        >
                          Change
                        </Button>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-2">
                      <Button onClick={finalizeBooking} fullWidth>
                        Confirm Booking Details
                      </Button>
                      <button 
                        onClick={() => handleAgentFallback()}
                        className="text-xs text-gray-400 hover:text-blue-500 font-medium transition-colors text-center py-2"
                      >
                        I think the extraction is incorrect
                      </button>
                    </div>
                  </div>
                )}

                {msg.type === 'provider_picker' && (
                  <div className="space-y-2">
                    {msg.data.map((prov: Provider) => (
                      <button
                        key={prov.id}
                        onClick={() => handleProviderChange(prov)}
                        className={`w-full p-3 bg-white border rounded-xl text-left transition-all ${selectedProvider.id === prov.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-bold text-gray-900">{prov.name}</span>
                          <span className="text-xs font-bold text-blue-600">₹{prov.optionalTestPrice} / test</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-gray-500 flex items-center gap-0.5"><span className="text-yellow-500">★</span> {prov.rating}</span>
                          <span className="text-[10px] text-green-600 font-medium">{prov.deliveryFee === 0 ? 'Free Home Collection' : `₹${prov.deliveryFee} Collection Fee`}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {msg.type === 'cart' && (
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-5 w-full">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-gray-900">Final Order Review</h3>
                      <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-1 rounded-md font-bold uppercase tracking-widest">
                        {msg.data.length} Items
                      </span>
                    </div>
                    
                    <div className="mb-4 p-2 bg-gray-50 rounded-lg flex items-center gap-3">
                      <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                        <Icons.User />
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-500 font-bold uppercase">Sample Collection Address</div>
                        <div className="text-xs font-medium text-gray-800">{selectedAddress?.label || 'Not selected'}: {selectedAddress?.details}</div>
                      </div>
                    </div>

                    <div className="space-y-3 mb-6">
                      {msg.data.map((item: TestItem, i: number) => (
                        <div key={i} className="flex justify-between items-start border-b border-gray-50 pb-2 last:border-0">
                          <div className="text-sm font-medium text-gray-700">{item.test_name}</div>
                          <div className="text-[10px] text-right font-semibold">
                            {item.source === 'prescription' ? (
                              <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded">Covered in Plan</span>
                            ) : (
                              <span className="text-blue-600">₹{selectedProvider.optionalTestPrice.toFixed(2)}</span>
                            )}
                          </div>
                        </div>
                      ))}
                      {selectedProvider.deliveryFee > 0 && (
                        <div className="flex justify-between items-start border-b border-gray-50 pb-2 last:border-0">
                          <div className="text-sm font-medium text-gray-500 italic">Home Collection Fee</div>
                          <div className="text-[10px] text-right font-semibold text-blue-600">₹{selectedProvider.deliveryFee.toFixed(2)}</div>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-dashed border-gray-200 pt-4 mb-6 space-y-2">
                      {coveredCount > 0 && (
                        <div className="flex justify-between text-xs font-medium text-gray-500">
                          <span>Plan Coverage ({coveredCount} Tests)</span>
                          <span className="text-green-600">Applied</span>
                        </div>
                      )}
                      
                      {totalDue === 0 ? (
                        <div className="bg-blue-50 p-2 rounded-lg flex items-center justify-between">
                          <span className="text-[10px] text-blue-700 font-bold">Wallet Deduction</span>
                          <span className="text-xs font-bold text-blue-800">₹0.00</span>
                        </div>
                      ) : (
                        <div className="flex justify-between text-sm font-bold text-gray-900 pt-1">
                          <span>Total Amount Payable</span>
                          <span>₹{totalDue.toFixed(2)}</span>
                        </div>
                      )}
                    </div>

                    <Button onClick={handlePayment} fullWidth size="lg" className="h-12 text-base rounded-xl">
                      {totalDue > 0 ? `Proceed to Secure Payment` : 'Confirm Booking'}
                    </Button>
                  </div>
                )}

                {msg.type === 'status' && (
                  <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping" />
                    <span className="text-xs font-medium text-gray-600">{msg.data.status}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {isTyping && (
          <div className="flex justify-start animate-fadeIn">
            <div className="flex gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                <Icons.Lab />
              </div>
              <div className="bg-gray-100 text-gray-400 p-3 rounded-2xl rounded-tl-none flex gap-1">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </main>

      {/* Input Area */}
      <footer className="p-4 bg-white border-t border-gray-100">
        {flowStep === FlowStep.AWAITING_PRESCRIPTION || flowStep === FlowStep.VALIDATION_FEEDBACK ? (
          <div className="space-y-3">
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*,.pdf" onChange={handleFileUpload} />
            <Button onClick={() => fileInputRef.current?.click()} fullWidth size="lg" variant="outline" className="border-2 border-dashed border-blue-200 bg-blue-50 hover:bg-blue-100 hover:border-blue-300 py-6">
              <div className="flex flex-col items-center">
                <div className="mb-2 p-2 bg-white rounded-full text-blue-600 shadow-sm">
                  <Icons.Upload />
                </div>
                <span className="text-blue-700 font-bold">Upload Prescription</span>
                <span className="text-[10px] text-blue-500 font-medium">JPEG, PNG, or PDF supported</span>
              </div>
            </Button>
            {flowStep === FlowStep.VALIDATION_FEEDBACK && (
              <Button variant="ghost" fullWidth size="sm" onClick={() => setFlowStep(FlowStep.WELCOME)}>
                Go Back
              </Button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-full border border-gray-100">
            <input 
              type="text" 
              placeholder="Type your message..." 
              disabled={flowStep === FlowStep.PROCESSING} 
              className="flex-1 bg-transparent border-none focus:ring-0 px-4 py-2 text-sm disabled:opacity-50"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  const input = e.currentTarget;
                  if (input.value.trim()) {
                    addMessage({ role: 'user', content: input.value });
                    input.value = '';
                    simulateTyping(1).then(() => {
                      addMessage({ role: 'assistant', content: "I'm focusing on your booking flow right now. Please use the options provided above to move forward." });
                    });
                  }
                }
              }}
            />
            <button className="bg-blue-600 text-white p-2.5 rounded-full shadow-md hover:bg-blue-700 transition-colors disabled:opacity-50" disabled={flowStep === FlowStep.PROCESSING}>
              <Icons.ArrowRight />
            </button>
          </div>
        )}
        <p className="text-[9px] text-center text-gray-400 mt-4 px-4 leading-tight">
          HealthSaathi Assistant follows strict clinical protocols. We do not provide medical advice. 
          All lab tests are validated by certified professionals.
        </p>
      </footer>

      <style>{`
        @keyframes slideInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .animate-slideInUp { animation: slideInUp 0.3s ease-out forwards; }
        .animate-fadeIn { animation: fadeIn 0.4s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default App;
