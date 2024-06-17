//steps to write tools
//configure chat tools (first openAI call)
//decide if tool call is required
//invoke the tool
//make a second openAI call with the tool response

import OpenAI from "openai";
const openAI = new OpenAI();

function getAvailableFlights(departure: string, destination: string): string[]{
    console.log('Getting available flights')
    if(departure == 'SFO' && destination == 'LAX'){
        return ['UA 123', 'AA 456'];
    }
    if(departure == 'DFW' && destination == 'LAX'){
        return ['AA 789'];
    }
    return ['66 FSFG'];
}

function reserveFlight(flightNumber: string) : string | 'FULLY_BOOKED' {
    if(flightNumber.length == 6){
        console.log(`Reserving flight ${flightNumber}`);
        return '12345';
    }
    else{
        return 'FULLY_BOOKED';
    }
}

const context: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
        role: 'system',
        content: 'You are a helpful assistant that gives the information about flights and makes reservations'
        //change the content to let the openai understand we need to extract the content from prompt
    }
];

async function callOpenAIWithFunctions(){
    const response =  await openAI.chat.completions.create({
        model: 'gpt-3.5-turbo-0613',
        messages: context,
        temperature: 1.0,
        tools: [
            {
                type: 'function',
                function: {
                    name: 'getAvailableFlights',
                    description: 'returns the qavailable flights for a given departure anad destination',
                    parameters: {
                        type: 'object',
                        properties: {
                            departure: {
                                type: 'string',
                                description: 'The departure airport code',
                            },
                            destination: {
                                type: 'string',
                                description: 'The destination airport code',
                            }
                        },
                        required: ['departure', 'destination'],
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'reserveFlight',
                    description: 'make a reservation for a given flight number',
                    parameters: {
                        type: 'object',
                        properties: {
                            flightNumber: {
                                type: 'string',
                                description: 'The flight number to reserve'
                            }
                        },
                        required: ['flightNumber']
                    }
                }
            }
        ],
        tool_choice: 'auto' //the engine will decide which tool to use
    });

    const willInvokeFunction = response.choices[0].finish_reason == 'tool_calls';

    if(willInvokeFunction) {
        const toolCall = response.choices[0].message.tool_calls![0];
        const functionName = toolCall.function.name

        if(functionName == 'getAvailableFlights'){
            const rawArgument = toolCall.function.arguments;
            const parsedArguments = JSON.parse(rawArgument);
            const flights = getAvailableFlights(parsedArguments.departure, parsedArguments.destination)
            
            context.push(response.choices[0].message);
            context.push({
                role: 'tool',
                content: flights.toString(),
                tool_call_id: toolCall.id
            })
        }

        if(functionName == 'reserveFlight'){
            const rawArgument = toolCall.function.arguments;
            const parsedArgument = JSON.parse(rawArgument);
            const reservationNumber = reserveFlight(parsedArgument.flightNumber);
            context.push(response.choices[0].message);

            context.push({
                role: 'tool',
                content: reservationNumber,
                tool_call_id: toolCall.id
            })
        }
    }

    const secondResponse = await openAI.chat.completions.create({
        model: 'gpt-3.5-turbo-0613',
        messages: context
    })

    console.log(secondResponse.choices[0].message.content)
}

console.log('Hello from flight assistant chatbot!')
process.stdin.addListener('data', async function (input){
    let userInput = input.toString().trim();
    context.push({
        role: 'assistant',
        content: userInput
    })
    await callOpenAIWithFunctions();
});